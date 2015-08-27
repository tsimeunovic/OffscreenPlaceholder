///
/// "OffscreenPlaceholder" virtual scroll module for AngularJs
/// https://github.com/tsimeunovic/OffscreenPlaceholder
///

(function(window, angular){
  'use strict';

  angular.module('offscreen-placeholder', [])
  .value('offscreenPlaceholderConfiguration', {
    scrollRoot: document.documentElement || document.body, //Element with scroll listener
    topOffset: 100, //Top offset above viewport where we start/stop displaying content
    bottomOffset: 200, //Bottom offset below viewport where we start/stop displaying content
    minimumItemsTreshold: 10, //Minimum items count that triggers feature
    measureElementTimeoutMs: 1 //Wait time before measuring DOM element dimensions
  })
  .service('offscreenPlaceholderCoordinator', ['offscreenPlaceholderConfiguration', function (offscreenPlaceholderConfiguration) {
    //Global variables
    var registeredElements = [];
    var renderedScrollTop = null;
    var scheduledUpdate = null;

    //Helper functions
    function checkUpdateNecessity(scrollTop) {
      if (registeredElements.length < offscreenPlaceholderConfiguration.minimumItemsTreshold) {
        //Make sure all elements are rendered if feature is not used
        for (var l = 0; l < registeredElements.length; l++) {
          if (!registeredElements[l].isInDom) {
            registeredElements[l].addToDom();
          }
        }
        return false;
      } else if (renderedScrollTop === scrollTop) {
        return false;
      }
      return true;
    }

    function getToggleElements(lowerBound, upperBound) {
      var toggleElements = [];
      for (var i = 0; i < registeredElements.length; i++) {
        var element = registeredElements[i];
        var shouldBeInDom = (element.topOffset + element.innerHeight) > lowerBound && element.topOffset < upperBound;
        if (element.isInDom != shouldBeInDom) {
          toggleElements.push(element);
        }
      }
      return toggleElements;
    }

    function pushUpdatesToElements(toggleElements) {
      for (var i = 0; i < toggleElements.length; i++) {
        var element = toggleElements[i];
        element[element.isInDom ? 'removeFromDom' : 'addToDom']();
      }
    }

    function registerListeners(register) {
      offscreenPlaceholderConfiguration.scrollRoot[register ? 'addEventListener' : 'removeEventListener']('scroll', updateElements);
      offscreenPlaceholderConfiguration.scrollRoot[register ? 'addEventListener' : 'removeEventListener']('touchmove', updateElements);
    }

    //Main update function
    function updateElements() {
      //Timeout cleanup
      if (scheduledUpdate) {
        window.clearTimeout(scheduledUpdate);
        scheduledUpdate = null;
      }

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

    function scheduleUpdate() {
      if (!scheduledUpdate) {
        scheduledUpdate = window.setTimeout(updateElements, 1);
      }
    }

    function registerElement(element) {
      registeredElements.push(element);
      if(registeredElements.length === 1) {
        registerListeners(true);
      }
      renderedScrollTop = null;
      scheduleUpdate();
    }

    function unregisterElement(element) {
      var index = registeredElements.indexOf(element);
      if (index > -1) {
        registeredElements.splice(index, 1);
      }
      if(registeredElements.length === 0) {
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
          topOffset: null //Offset relative to document top
        };

        //Fill with provided values if available
        if ($attr.offscreenPlaceholder) {
          var providedValues = $attr.offscreenPlaceholder.split(",");
          elementObj.innerHeight = parseFloat(providedValues[0], 10);
          var margins = providedValues.length > 1 ? parseFloat(providedValues[1], 10) : 0;
          elementObj.height = elementObj.innerHeight + margins;
        }

        //Add to DOM
        elementObj.addToDom = function () {
          //Insert content
          if (!childScope) {
            $transclude($scope.$new(), function (clone, newScope) {
              childScope = newScope;
              $animate.enter(clone, $element.parent(), $element);
            });
          }
          contentElement = $element[0].nextSibling;

          //Add inline height attribute to prevent jump while rendering
          if (elementObj.innerHeight) {
            $element[0].nextSibling.setAttribute("style", "height:" + elementObj.innerHeight + "px");
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
          placeholder = document.createElement('div');
          placeholder.setAttribute("style", "height:" + elementObj.height + "px;margin:0px;");
          $element[0].parentNode.insertBefore(placeholder, $element[0].nextSibling);

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
          var box = element.getBoundingClientRect();
          var topOffset = box.top + window.pageYOffset - de.clientTop;
          elementObj.topOffset = topOffset;
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
