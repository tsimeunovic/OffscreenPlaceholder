# OffscreenPlaceholder
Universal AngularJs virtual scrolling module

## What does it do?
It unloads elements that are not visible within specific boundaries and replace them with same height placeholder so that end user does not notice anything. It is also usable for lazy loading of elements. Compared to other available solutions, it does not require all elements to be of same height or within common scrollable direct parent element and works even when height is not predictable in advance (not so efficient however). Overall minified size is around 3kb.

## How do I use it?
Install via bower
```bash
bower install offscreen-placeholder
```
then include javascript file. Or reference script file from GitHub
```html
<script src="https://cdn.rawgit.com/tsimeunovic/OffscreenPlaceholder/master/offscreenPlaceholder.min.js"></script>
```

Load `offscreen-placeholder` module in your angular module
```javascript
angular.module('YourApp', ['dependency1', 'dependency2', 'offscreen-placeholder']);
```

Add `offscreen-placeholder` attribute on element that you want to hide when off screen
```html
<div ng-repeat="item in longList">
  <div some-attribute="true" class="list-item" offscreen-placeholder>
    <!-- Content omitted -->
  </div>
</div>
```

If you know element height and top and bottom margin in advance, pass it in attribute as 2 comma separated values to improve performance
```html
<div ng-repeat="item in longList">
  <div some-attribute="true" class="list-item" offscreen-placeholder="100,10">
    <!-- Content omitted -->
  </div>
</div>
```

## How do I configure it?
There is value object `offscreenPlaceholderConfiguration` registered that holds configuration options. You can include it in any service/controller and change parameters as you like
- **scrollRoot** is DOM element that we track scrolling for. By default its body
- **topOffset** size in px above window where content should appear/disappear. Default is 100
- **bottomOffset** size in px below window where content should appear/disappear. Default is 200
- **minimumItemsThreshold** specify how much elements must be registered to activate feature. Default is 10
- **measureElementTimeoutMs** specify how long timeout is set (in ms) between adding element to DOM and measuring its dimensions. Some more complicated elements might require more time to properly render. Default is 1
- **scrollEndRenderTimeoutMs** specify time in ms between scroll end and recalculation with rendering starts. Default is 0, which means immediately
