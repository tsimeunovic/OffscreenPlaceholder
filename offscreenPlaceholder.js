///
/// "OffscreenPlaceholder" virtual scroll module for AngularJs
/// https://github.com/tsimeunovic/OffscreenPlaceholder
///

(function (window, angular) {
  'use strict';

  angular.module('offscreen-placeholder', [])
    .value('offscreenPlaceholderConfiguration', {
      scrollRoot: document.documentElement || document.body, //Element with scroll listener
      topOffset: 100, //Top offset above viewport where we start/stop displaying content
      bottomOffset: 200, //Bottom offset below viewport where we start/stop displaying content
      minimumItemsThreshold: 10, //Minimum items count that triggers feature
      measureElementTimeoutMs: 1, //Wait time before measuring DOM element dimensions
      scrollEndRenderTimeoutMs: 0, //Wait time between scroll end and elements re-rendering
      usePerItemPlaceholder: false, //Determines if every item gets its own placeholder
      placeholderContentTemplate: null //Inner content of placeholder element
    })
    .service('offscreenPlaceholderCoordinator', ['offscreenPlaceholderConfiguration', function (offscreenPlaceholderConfiguration) {
      //Global variables
      var registeredElementGroups = []; //Array of objects {parent:{DOMElement}, elements:[]}
      var renderedScrollTop = null;
      var scheduledUpdate = null;

      //Helper functions
      function getElementGroupFor(parent, createIfNotExist) {
        for (var i = 0; i < registeredElementGroups.length; i++) {
          if (registeredElementGroups[i].parent === parent) {
            return registeredElementGroups[i];
          }
        }
        if (createIfNotExist) {
          var newGroup = {
            parent: parent,
            elements: [],
            totalHeight: 0
          };

          registeredElementGroups.push(newGroup);
          if (!offscreenPlaceholderConfiguration.usePerItemPlaceholder) {
            //Create global placeholder
            var placeholder = document.createElement('div');
            placeholder.setAttribute('style', 'height:0px;margin:0px;overflow:hidden;');
            placeholder.innerHTML = offscreenPlaceholderConfiguration.placeholderContentTemplate;
            parent.insertBefore(placeholder, parent.childNodes[0]);
            newGroup.placeholder = placeholder;
          }

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
            toggleElements: toggleElementsForContainer,
            placeholder: elementsGroup.placeholder
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
          if (!offscreenPlaceholderConfiguration.usePerItemPlaceholder) {
            toggleElementsGroup.placeholder.setAttribute('style', 'height:' + toggleElementsGroup.totalTopOffset + 'px;margin:0px;overflow:hidden;');
          }
        }
      }

      //Main update function
      function updateElements() {
        //Timeout cleanup
        clearScheduledUpdate();

        //Check if update is necessary
        var scrollTop = offscreenPlaceholderConfiguration.scrollRoot.scrollTop;
        if (!checkUpdateNecessity(scrollTop)) {
          return;
        }

        //Determine region of update
        var lowerMustHave = scrollTop - offscreenPlaceholderConfiguration.topOffset;
        var upperMustHave = scrollTop + window.innerHeight + offscreenPlaceholderConfiguration.bottomOffset;

        //Find out which elements need to be toggled
        var toggleElements = getToggleElements(lowerMustHave, upperMustHave);

        //Update elements
        pushUpdatesToElements(toggleElements);
        renderedScrollTop = scrollTop;
      }

      //Updates scheduling
      function clearScheduledUpdate() {
        if (scheduledUpdate) {
          window.clearTimeout(scheduledUpdate);
          scheduledUpdate = null;
        }
      }

      function scheduleUpdate(scheduleMs) {
        if (!scheduledUpdate) {
          scheduledUpdate = window.setTimeout(updateElements, scheduleMs);
        }
      }

      function rescheduleUpdate(nextScheduleMs) {
        clearScheduledUpdate();
        scheduleUpdate(nextScheduleMs);
      }

      //Event listeners
      function scrollChangedHandler() {
        var renderWaitMs = offscreenPlaceholderConfiguration.scrollEndRenderTimeoutMs;
        renderWaitMs ? rescheduleUpdate(renderWaitMs) : updateElements();
      }

      function registerListeners(register) {
        offscreenPlaceholderConfiguration.scrollRoot[register ? 'addEventListener' : 'removeEventListener']('scroll', scrollChangedHandler);
        offscreenPlaceholderConfiguration.scrollRoot[register ? 'addEventListener' : 'removeEventListener']('touchmove', scrollChangedHandler);
      }

      //Exposed functions
      function registerElement(element) {
        var firstRegisteredElement = !registeredElementGroups.length;
        var elementGroup = getElementGroupFor(element.parentElement, true);
        if (!offscreenPlaceholderConfiguration.usePerItemPlaceholder) {
          //Update element top offset and parent height
          element.topOffset += elementGroup.totalHeight;
          elementGroup.totalHeight += element.height;
          element.parentElement.setAttribute('style', 'height:' + elementGroup.totalHeight + 'px;');
        }
        elementGroup.elements.push(element);
        if (firstRegisteredElement) {
          registerListeners(true);
        }
        renderedScrollTop = null;
        scheduleUpdate(1);
      }

      function unregisterElement(element) {
        var elementGroup = getElementGroupFor(element.parentElement, false);
        if (elementGroup) {
          //Remove element
          var index = elementGroup.elements.indexOf(element);
          if (index > -1) {
            elementGroup.elements.splice(index, 1);
          }
          //If no element is left, remove entire group
          if (elementGroup.elements.length === 0) {
            var groupIndex = registeredElementGroups.indexOf(elementGroup);
            registeredElementGroups.splice(groupIndex, 1);
          }
        }
        if (!registeredElementGroups.length) {
          registerListeners(false);
        }
      }

      //Force update on window size change
      window.addEventListener('resize', function () {
        renderedScrollTop = null;
        updateElements();
      });

      //Public api
      return {
        registerElement: registerElement,
        unregisterElement: unregisterElement
      };
    }])
    .directive('offscreenPlaceholder', ['$animate', 'offscreenPlaceholderCoordinator', 'offscreenPlaceholderConfiguration', function ($animate, offscreenPlaceholderCoordinator, offscreenPlaceholderConfiguration) {
      return {
        multiElement: true,
        transclude: 'element',
        priority: 500,
        terminal: true,
        restrict: 'A',
        $$tlb: true,
        link: function ($scope, $element, $attr, ctrl, $transclude) {
          var childScope, placeholder, contentElement;

          //Object describing element and providing functions to add and remove it
          var elementObj = {
            addToDom: null, //Function to add element to DOM
            removeFromDom: null, //Function to remove element from DOM
            isInDom: false, //Determines if element is rendered
            innerHeight: null, //Height without margin
            height: null, //Total height with margin
            topOffset: null, //Offset relative to document top
            parentElement: null //Elements direct parent
          };

          //Fill with provided values if available
          if ($attr.offscreenPlaceholder) {
            var providedValues = $attr.offscreenPlaceholder.split(',');
            elementObj.innerHeight = parseFloat(providedValues[0], 10);
            var margins = providedValues.length > 1 ? parseFloat(providedValues[1], 10) : 0;
            elementObj.height = elementObj.innerHeight + margins;
            elementObj.parentElement = $element.parent()[0];
          }

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

            //Add inline height attribute to prevent jump while rendering
            if (elementObj.innerHeight) {
              $element[0].nextSibling.setAttribute('style', 'height:' + elementObj.innerHeight + 'px');
            }

            //Remove placeholder
            if (placeholder) {
              placeholder.parentNode.removeChild(placeholder);
            }

            //Set state
            elementObj.isInDom = true;
          };

          //Remove from DOM
          elementObj.removeFromDom = function () {
            //Create placeholder and remove content
            if (offscreenPlaceholderConfiguration.usePerItemPlaceholder) {
              placeholder = document.createElement('div');
              placeholder.setAttribute('style', 'height:' + elementObj.height + 'px;margin:0px;overflow:hidden;');
              placeholder.innerHTML = offscreenPlaceholderConfiguration.placeholderContentTemplate;
              $element[0].parentNode.insertBefore(placeholder, $element[0].nextSibling);
            }

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

          var measureElementDimensions = function () {
            //Update element dimensions if real element is available
            var element = $element[0].nextSibling;

            //Height
            if (!elementObj.height) {
              var elementHeight = element.offsetHeight;
              var elementMargin = document.all ?
              parseInt(element.currentStyle.marginTop, 10) + parseInt(element.currentStyle.marginBottom, 10) :
              parseInt(document.defaultView.getComputedStyle(element, '').getPropertyValue('margin-top')) + parseInt(document.defaultView.getComputedStyle(element, '').getPropertyValue('margin-bottom'));
              elementObj.innerHeight = elementHeight;
              elementObj.height = elementHeight + elementMargin;
            }

            //Offset
            var de = document.documentElement;
            var box = element.getBoundingClientRect ? element.parentElement.getBoundingClientRect() : element.parentElement.getBoundingClientRect();
            elementObj.topOffset = box.top + window.pageYOffset - de.clientTop;
          };

          var measureAndRegister = function () {
            //Measure actual dimensions
            measureElementDimensions();

            //Subscribe
            offscreenPlaceholderCoordinator.registerElement(elementObj);
          };

          //Create element (or placeholder), measure it and then register to 'offscreenPlaceholderCoordinator' service
          elementObj[elementObj.height ? 'removeFromDom' : 'addToDom']();
          setTimeout(measureAndRegister, offscreenPlaceholderConfiguration.measureElementTimeoutMs);

          //Destroy cleanup
          $scope.$on('$destroy', function () {
            offscreenPlaceholderCoordinator.unregisterElement(elementObj);
          });
        }
      };
    }]);
})(window, window.angular);
