# Developer
      
Develop and publish your own Roam extensions with the help of RoamJS!

## Usage
The Developer extension on RoamJS helps other software engineers develop and share extensions with other Roam users! It provides features for developing from within Roam as well as exposing methods from RoamJS' official [npm package](https://npmjs.com/roamjs-components).

## Developing within Roam
To get started developing within Roam, simply enter three back ticks into a block. Roam natively will render a code editor where you can start writing your logic.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FcpGj9vg1c2.00.17%20PM.png?alt=media&token=ced7a892-2ec5-419f-9d2b-93b07911b242)

To easily invoke this logic without having to reload Roam each time, create a button in Roam with the following syntax: `{{name:developer:uid}}`. Clicking this button will look for a code block within the block referenced by `uid` and invoke the logic contained within it. `name` could be any text value that doesn't contain a colon that you want.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FdFr9G-GW1f.00.59%20PM.png?alt=media&token=b7515150-a650-40d2-b608-1ee88b32d849)

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FPjrj8kZex0.01.09%20PM.png?alt=media&token=a00101b0-0d22-48bc-bc6f-6dc1b2b3bb2f)

## Developing outside of Roam
RoamJS manages two NPM packages, both of which have been vetted by the Roam team themselves:
- [RoamJS Components](https://roamjs.com/extensions/developer/roamjs_components) - This package contains all of the UI components and utilities RoamJS uses to build extensions
- [RoamJS Scripts](https://roamjs.com/extensions/developer/roamjs_scripts) - This package contains all of the build scripts and command line utilities RoamJS uses to build extensions

These packages are what all RoamJS extensions are built on top of. As a developer, you are not required to use either of these extensions, but they exist to make your life easier getting started.

## Resources
Most existing developer documentation lives at [developer.roamjs.com](https://developer.roamjs.com). Stay tuned while we migrate that information to RoamJS.
