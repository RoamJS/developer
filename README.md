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

You can also create a live REPL by entering a `{{repl}}` button inside of a block.

## Developing outside of Roam

RoamJS manages two NPM packages, both of which have been vetted by the Roam team themselves:

- [RoamJS Components](https://roamjs.com/extensions/developer/roamjs_components) - This package contains all of the UI components and utilities RoamJS uses to build extensions
- [RoamJS Scripts](https://roamjs.com/extensions/developer/roamjs_scripts) - This package contains all of the build scripts and command line utilities RoamJS uses to build extensions

These packages are what all RoamJS extensions are built on top of. As a developer, you are not required to use either of these extensions, but they exist to make your life easier getting started.

## Connecting to GitHub

In your Roam Depot settings for the developer extension, you could add your GitHub username and API token. You can retrieve an API token from the from your developer settings on GitHub. Once connected, you'll have access to features specific to accessing your GitHub account from within Roam!

To import GitHub issues you have open, open the Roam Command Palette and enter `Import My GitHub Issues`.

## Postman

When the extension is installed, it will set up a config page for you at `roam/js/postman` like the one below:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fi6KNstFsKI.png)

The structure of the config is as follows:

- apis - The set of all endpoints you have configured to hit. Each child is labelled with the tag that the extension will detect to send data.
  - url - The url of the API, set as the child of this block. Values could be interpolated with the following variables:
    - `{id}` - The block reference id of the current block
  - body - The data to send on the POST request. Each child of body is a key and each child of the key is a value. Values could be interpolated with the following variables:
    - `{id}` - The block reference id of the current block
    - `{block}` - The text contents of the current block. Use `{block:clean}` to omit the tag used to setup the endpoint.
    - `{tree}` - The full contents of the block tree, in a stringified JSON. Use `{tree:text}` to get the tree in a plain text format and `{text:html}` to get the tree in a HTML format.
    - `{attribute:{field}}` - Finds a child block with the Roam attribute of "field" (case-insensitive), and replaces with the attribute value. For example, a configuration of `{attribute:foo}` on a block with a child of `Foo:: bar` will replace the placeholder with `"bar"`.
  - headers - The set of headers to send with the request, useful for sending Authorization or other headers. Just like body, each child represents the header name, and the child of the header name is the header value.

The image above renders an icon next to any `#[[PostmanExample]]` tags. Clicking the icon on a block that says `Send This! #[[PostmanExample]]` would send the following request:

```json
{
  "url": "https://api.roamjs.com/postman",
  "body": {
    "foo": "bar",
    "block_content": "Contents: Send This! #[[PostmanExample]]",
    "tree_content": "{}"
  },
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  }
}
```

The RoamJS `postman` endpoint is available to help test your configuration. The config page should include the URLs that you actually want to hit for each tag.

### Custom Bodies

By default, Postman parses the configuration under `body` as a key value string map. You could specify unique types on any given value or on the body itself by specifying one of the following:

- `{string}`
- `{boolean}`
- `{number}`
- `{array}`
- `{object}`

The `body` has a default type of `{object}`. We could change this by using one of the other four options above. The following configuration will send an array of three strings as the body:

```
- body {array}
  - foo
  - bar
  - baz
```

All other values have a default type of `{string}`. See the example below for how to specify a value of each type:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fgr_otEhBA5.png)

This example would send the following body:

```json
{
  "booleanKey": true,
  "numberKey": 5,
  "stringKey": "foo",
  "arrayKey": ["foo", "bar", "baz"],
  "objectKey": {
    "foo": "bar",
    "baz": "hello, world"
  }
}
```

## Resources

Most existing developer documentation lives at [developer.roamjs.com](https://developer.roamjs.com). Stay tuned while we migrate that information to RoamJS.
