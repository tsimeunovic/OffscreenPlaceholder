///
/// "OffscreenPlaceholder" virtual scroll module for AngularJs
/// https://github.com/tsimeunovic/OffscreenPlaceholder
///

(function (window, angular) {
    'use strict';

    //Register angular components
    angular.module('offscreen-placeholder', [])
        .value('offscreenPlaceholderConfiguration', {
            scrollRoot: document, //Element with scroll listener
            topOffset: 100, //Top offset above viewport where we start/stop displaying content
            bottomOffset: 200, //Bottom offset below viewport where we start/stop displaying content
            minimumItemsThreshold: 10 //Minimum items count that triggers feature
        })
        .service('offscreenPlaceholderCoordinator', ['offscreenPlaceholderConfiguration', function (offscreenPlaceholderConfiguration) {
            //Global variables
            var registeredElementGroups = []; //Array of objects {parent:{DOMElement}, elements:[]}
            var requestAnimationFrameVersion = 0;
            var renderedScrollTop = null;
            var scheduledUpdate = null;
            var scrollingElement = null;

            //Helper functions
            function getElementGroupFor(parent, createIfNotExist) {
                for (var i = 0; i < registeredElementGroups.length; i++) {
                    if (registeredElementGroups[i].parent === parent) {
                        return registeredElementGroups[i];
                    }
                }
                if (createIfNotExist) {
                    //Measure group top offset
                    var box = parent.getBoundingClientRect ? parent.parentElement.getBoundingClientRect() : parent.parentElement.getBoundingClientRect();
                    var groupTopOffset = box.top + scrollingElement.scrollTop - document.documentElement.clientTop;

                    var newGroup = {
                        parent: parent,
                        topOffset: groupTopOffset,
                        elements: [],
                        totalHeight: 0
                    };

                    registeredElementGroups.push(newGroup);
                    return newGroup;
                }
            }

            function checkUpdateNecessity(scrollTop) {
                //Make sure all elements are rendered if feature is not used
                var overThreshold = false;
                for (var i = 0; i < registeredElementGroups.length; i++) {
                    var elementsGroup = registeredElementGroups[i];
                    if (elementsGroup.length < offscreenPlaceholderConfiguration.minimumItemsThreshold) {
                        for (var l = 0; l < elementsGroup.elements.length; l++) {
                            if (!elementsGroup.elements[l].isInDom) {
                                elementsGroup.elements[l].addToDom();
                            }
                        }
                    } else {
                        overThreshold = true;
                    }
                }
                return overThreshold && renderedScrollTop !== scrollTop;
            }

            function getToggleElements(lowerBound, upperBound) {
                var toggleElements = [];
                for (var j = 0; j < registeredElementGroups.length; j++) {
                    var elementsGroup = registeredElementGroups[j];
                    var foundFirst = false;
                    var totalTopOffset = 0;
                    var toggleElementsForContainer = [];

                    for (var i = 0; i < elementsGroup.elements.length; i++) {
                        var element = elementsGroup.elements[i];
                        var shouldBeInDom = (element.topOffset + element.innerHeight) > lowerBound && element.topOffset < upperBound;
                        foundFirst = foundFirst || shouldBeInDom;
                        if (!foundFirst && !shouldBeInDom) {
                            totalTopOffset += element.height;
                        }
                        if (element.isInDom !== shouldBeInDom) {
                            toggleElementsForContainer.push(element);
                        }
                    }

                    toggleElements.push({
                        parent: elementsGroup.parent,
                        totalHeight: elementsGroup.totalHeight,
                        totalTopOffset: totalTopOffset,
                        toggleElements: toggleElementsForContainer
                    });
                }
                return toggleElements;
            }

            function pushUpdatesToElements(toggleElements) {
                for (var j = 0; j < toggleElements.length; j++) {
                    var toggleElementsGroup = toggleElements[j];
                    for (var i = 0; i < toggleElementsGroup.toggleElements.length; i++) {
                        var element = toggleElementsGroup.toggleElements[i];
                        element[element.isInDom ? 'removeFromDom' : 'addToDom']();
                    }
                }
            }

            //Main update function
            function updateElements() {
                //Timeout cleanup
                clearScheduledUpdate();

                //Check if update is necessary
                var scrollTop = scrollingElement.scrollTop;
                if (!checkUpdateNecessity(scrollTop)) {
                    return;
                }

                //Determine region of update
                var lowerMustHave = scrollTop - offscreenPlaceholderConfiguration.topOffset;
                var upperMustHave = scrollTop + window.innerHeight + offscreenPlaceholderConfiguration.bottomOffset;

                //Find out which elements need to be toggled
                var toggleElements = getToggleElements(lowerMustHave, upperMustHave);

                //Update elements
                var updateVersion = ++requestAnimationFrameVersion;
                requestAnimationFrame(function () {
                    if (updateVersion === requestAnimationFrameVersion) {
                        pushUpdatesToElements(toggleElements);
                    }
                });
                renderedScrollTop = scrollTop;
            }

            //Updates scheduling
            function scheduleForcedUpdate() {
                renderedScrollTop = null;
                if (!scheduledUpdate) {
                    scheduledUpdate = window.setTimeout(updateElements, 1);
                }
            }

            function clearScheduledUpdate() {
                if (scheduledUpdate) {
                    window.clearTimeout(scheduledUpdate);
                    scheduledUpdate = null;
                }
            }

            //Event listeners
            function registerListeners(register) {
                offscreenPlaceholderConfiguration.scrollRoot[register ? 'addEventListener' : 'removeEventListener']('scroll', updateElements);
                offscreenPlaceholderConfiguration.scrollRoot[register ? 'addEventListener' : 'removeEventListener']('touchmove', updateElements);
                window[register ? 'addEventListener' : 'removeEventListener']('resize', scheduleForcedUpdate);
            }

            function registerElement(element) {
                //If is first element, register listeners and determine scrolling element
                if (!registeredElementGroups.length) {
                    registerListeners(true);
                    var scrollRoot = offscreenPlaceholderConfiguration.scrollRoot;
                    scrollingElement = scrollRoot.scrollingElement || scrollRoot.documentElement || scrollRoot;
                }

                //Get element group
                var elementGroup = getElementGroupFor(element.parentElement, true);

                //Update element top offset and parent total height
                element.topOffset = elementGroup.topOffset + elementGroup.totalHeight;
                elementGroup.totalHeight += element.height;
                element.parentElement.setAttribute('style', 'height:' + elementGroup.totalHeight + 'px;position:relative;transform:translatez(0);');

                //Add element to element group
                elementGroup.elements.push(element);
                element.elementGroup = elementGroup;

                //Schedule update
                scheduleForcedUpdate();
            }

            function unregisterElement(element) {
                //Remove element
                var elementGroup = element.elementGroup;
                var index = elementGroup.elements.indexOf(element);
                if (index > -1) {
                    elementGroup.elements.splice(index, 1);
                }
                element.elementGroup = null;

                //If no element is left, remove entire group
                if (elementGroup.elements.length === 0) {
                    var groupIndex = registeredElementGroups.indexOf(elementGroup);
                    registeredElementGroups.splice(groupIndex, 1);
                }

                //If no group is left, remove listeners
                if (!registeredElementGroups.length) {
                    registerListeners(false);
                }
            }

            //Public api
            return {
                registerElement: registerElement,
                unregisterElement: unregisterElement
            };
        }])
        .directive('offscreenPlaceholder', ['$animate', '$parse', 'offscreenPlaceholderCoordinator', function ($animate, $parse, offscreenPlaceholderCoordinator) {
            return {
                multiElement: true,
                transclude: 'element',
                priority: 500,
                terminal: true,
                restrict: 'A',
                $$tlb: true,
                link: function ($scope, $element, $attr, ctrl, $transclude) {
                    var childScope, contentElement;

                    //Object describing element and providing functions to add and remove it
                    var elementObj = {
                        addToDom: null, //Function to add element to DOM
                        removeFromDom: null, //Function to remove element from DOM
                        isInDom: false, //Determines if element is rendered
                        innerHeight: null, //Height without margin
                        height: null, //Total height with margin
                        topOffset: null, //Offset relative to document top
                        parentElement: null, //Elements direct parent
                        elementGroup: null //Reference to group of related elements
                    };

                    //Add to DOM
                    elementObj.addToDom = function () {
                        //Insert content
                        if (!childScope) {
                            $transclude($scope.$new(), function (clone, newScope) {
                                childScope = newScope;
                                $animate.enter(clone, elementObj.parentElement, $element);
                            });
                        }
                        contentElement = $element[0].nextSibling;

                        //Add inline height attribute to prevent jump while rendering and translatez for performance
                        var elementTop = elementObj.topOffset - elementObj.elementGroup.topOffset;
                        contentElement.setAttribute('style', 'height:' + elementObj.innerHeight + 'px;position:absolute;top:' + elementTop + 'px;transform:translatez(0);');

                        //Set state
                        elementObj.isInDom = true;
                    };

                    //Remove from DOM
                    elementObj.removeFromDom = function () {
                        //Remove content and dispose created child scope
                        if (contentElement) {
                            contentElement.parentNode.removeChild(contentElement);
                            if (childScope) {
                                childScope.$destroy();
                                childScope = null;
                            }
                            contentElement = null;
                        }

                        //Set state
                        elementObj.isInDom = false;
                    };

                    //Init
                    (function () {
                        //Fill with provided values
                        var input = $attr.offscreenPlaceholder.match(/^[\d,\s]+$/g) ? $attr.offscreenPlaceholder : $parse($attr.offscreenPlaceholder)($scope).toString();
                        var providedValues = input.split(',');
                        elementObj.innerHeight = parseFloat(providedValues[0], 10);
                        var margins = providedValues.length > 1 ? parseFloat(providedValues[1], 10) : 0;
                        elementObj.height = elementObj.innerHeight + margins;
                        elementObj.parentElement = $element.parent()[0];

                        //Register element
                        offscreenPlaceholderCoordinator.registerElement(elementObj);

                        //Destroy cleanup
                        $scope.$on('$destroy', function () {
                            offscreenPlaceholderCoordinator.unregisterElement(elementObj);
                        });
                    })();
                }
            };
        }]);
})
(window, window.angular);
