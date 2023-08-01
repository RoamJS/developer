# Developer

Develop and publish your own Roam extensions with the help of RoamJS!

## Usage

The Developer extension on RoamJS helps other software engineers develop and share extensions with other Roam users! It provides features for developing from within Roam as well as exposing methods from RoamJS' official [npm package](https://npmjs.com/roamjs-components).

## Developing within Roam

To get started developing within Roam, simply enter three back ticks into a block. Roam natively will render a code editor where you can start writing your logic.

![](https://github.com/RoamJS/developer/assets/3792666/40d2e6d6-4835-49b6-832c-f7e12ed2a36d)

To easily invoke this logic without having to reload Roam each time, create a button in Roam with the following syntax: `{{name:developer:uid}}`. Clicking this button will look for a code block within the block referenced by `uid` and invoke the logic contained within it. `name` could be any text value that doesn't contain a colon that you want.

![](https://github.com/RoamJS/developer/assets/3792666/ef89d604-126a-4375-a0d6-758920886e5b)

![](https://github.com/RoamJS/developer/assets/3792666/7ed3302c-bb95-40fb-8948-d507b4cbfca9)

You can also create a live REPL by entering a `{{repl}}` button inside of a block.

## Developing outside of Roam

We recommend checking out the [Roam Depot Docs](https://roamresearch.com/#/app/developer-documentation/page/5BB8h4I7b) for developing your extension outside of Roam. One major benefit you get from this approach over the previous one is access to a new `extensionAPI` that gets passed into your extension's `onload` function.

RoamJS manages two NPM packages, both of which have been vetted by the Roam team themselves:

- [RoamJS Components](https://npmjs.com/roamjs-components) - This package contains all of the UI components and utilities RoamJS uses to build extensions
- [SamePage Scripts](https://www.npmjs.com/package/@samepage/scripts) - This package contains all of the build scripts and command line utilities RoamJS uses to build extensions

These packages are what all RoamJS extensions are built on top of. As a developer, you are not required to use either of these extensions, but they exist to make your life easier getting started.

## Connecting to GitHub

In your Roam Depot settings for the developer extension, you could add your GitHub username and API token. You can retrieve an API token from the from your developer settings on GitHub. Once connected, you'll have access to features specific to accessing your GitHub account from within Roam!

To import GitHub issues you have open, open the Roam Command Palette and enter `Import My GitHub Issues`.

## Postman

When the extension is installed, it will set up a config page for you at `roam/js/postman` like the one below:

![image](https://github.com/RoamJS/developer/assets/3792666/22ce3424-c00c-41c8-b23a-6f93182fcc13)

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

The image above renders an icon next to any `#[[PostmanExample]]` tags.

![image](https://github.com/RoamJS/developer/assets/3792666/7911f95b-1a5d-4382-804b-75c72516760e)

Clicking the icon on a block would send the following request:

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

![image](https://github.com/RoamJS/developer/assets/3792666/2674e944-32b3-4cc0-8360-2a085f5da80c)

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

## Sparql Querying

You can run a SPARQL queries with the `developer` extension! To do so, open the Roam command palette with CMD+p (CTRL+p on Windows) and search for "Run SPARQL Query". This will open a dialog where you could run one of two types of SPARQL queries.

### Sparql Querying Current Page

This will run a query to search all the properties of an entity based on the current page name and will bring the specified number of values. They will be created as pairs of blocks in your graph in the following way: properties as Roam attributes and their values as child blocks. All attributes will show the matching Wikidata property in their page, linked with `same as::` attribute. All property values, which are entities (people, places, and things as opposed to numbers and dates ) will be created (or reused if existing) as page references and their matching Wikidata item URI will be inserted as value of `same as::` attribute, the same way as the property.

### Sparql Querying Current Block

This will run a query to search all of the properties of an entity based on the current block text. If the current block text is empty, it will use the parent block. All properties and entities imported will automatically tagged with a reference to their link on their respective pages.

### Custom Sparql Query

You could write your own query in the code box in the dialog. The code block supports SPARQL query syntax. The results of the query will output with entity values being chilren of select variable names.

### Custom Sparql Query Label

You could define a custom global default label on the `roam/js/sparql` page. Each query could also use its own label, accessible by expanding the additional options. The `{date}` placeholder can be used to record the datetime of the import.

## Resources

Check out [this video](https://www.youtube.com/watch?v=SjGHqTQAhPE) from [Ivo Velitchkov](https://twitter.com/kvistgaard/status/1430161802214748164) on importing data from Wikdata into your Roam database!

Also from Ivo, [a guide to using Sparql](https://kvistgaard.github.io/sparql/).
