(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.graphologyGEXF = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/**
 * Graphology Browser GEXF Endpoint
 * =================================
 *
 * Endpoint gathering both parser & writer for the browser.
 */
exports.parse = require('./parser.js');
exports.write = require('../common/writer.js');

},{"../common/writer.js":5,"./parser.js":2}],2:[function(require,module,exports){
/**
 * Graphology Browser GEXF Parser
 * ===============================
 *
 * Browser version of the graphology GEXF parser.
 */
var createParserFunction = require('../common/parser.js');

module.exports = createParserFunction(DOMParser, Document);

},{"../common/parser.js":4}],3:[function(require,module,exports){
/**
 * Graphology Common GEXF Helpers
 * ===============================
 *
 * Miscellaneous helpers used by both instance of the code.
 */

var SPACE_PATTERN = /^\s$/;
var COMMA_SPLITTER = /\s*,\s*/;
var PIPE_SPLITTER = /\s*\|\s*/;

function isSpace(char) {
  return SPACE_PATTERN.test(char);
}

function parseListPieces(string) {
  var c, n, i, l;

  var inPiece = false;
  var escaping = false;
  var piece = undefined;
  var pieces = [];
  var quoting = '';

  for (i = 0, l = string.length; i < l; i++) {
    c = string[i];

    if (inPiece) {
      if (piece === undefined) {
        piece = '';
      }

      if (!quoting && c === ',') {
        i--;
        inPiece = false;
        continue;
      }

      if (!escaping && c === quoting) {
        inPiece = false;
        continue;
      }

      if (c === '\\') {
        if (i + 1 < l) {
          n = string[i + 1];

          if (n === 'r' || n === 't' || n === 'n' || n === '\\') {
            if (n === 'n') {
              piece += '\n';
            } else if (n === 't') {
              piece += '\t';
            } else if (n === 'r') {
              piece += '\r';
            } else {
              piece += '\\';
            }

            escaping = false;
            i++;
            continue;
          }
        }

        escaping = true;
      } else {
        piece += c;
        escaping = false;
      }
    } else {
      if (isSpace(c)) {
        continue;
      }

      if (c === ',') {
        if (piece !== undefined) {
          pieces.push(piece);
          piece = undefined;
        }

        continue;
      }

      if (c === '"' || c === "'") {
        quoting = c;
      } else {
        i--;
        quoting = '';
      }

      inPiece = true;
      escaping = false;
    }
  }

  // Flushing last piece
  if (piece !== undefined) {
    pieces.push(piece);
  }

  return pieces;
}

function parseScalarValue(type, string) {
  if (!type || type === 'string') {
    return string;
  }

  if (type === 'boolean') {
    return string === 'true';
  }

  // NOTE: long might cause issues at some point because
  // JavaScript does not handle 64bit integers.
  if (
    type === 'byte' ||
    type === 'short' ||
    type === 'integer' ||
    type === 'long' ||
    type === 'float' ||
    type === 'double'
  ) {
    return +string;
  }

  // NOTE: we fallback to raw string value
  return string;
}

function parseValue(type, string) {
  if (type.startsWith('list')) {
    var subtype = type.slice(4);
    var pieces;

    if (
      string.length >= 2 &&
      string[0] === '[' &&
      string[string.length - 1] === ']'
    ) {
      pieces = parseListPieces(string.slice(1, -1));
    } else if (string.includes('|')) {
      pieces = string.split(PIPE_SPLITTER);
    } else if (string.includes(',')) {
      pieces = string.split(COMMA_SPLITTER);
    } else {
      pieces = [string];
    }

    return pieces.map(function (piece) {
      return parseScalarValue(subtype, piece);
    });
  } else {
    return parseScalarValue(type, string);
  }
}

exports.parseListPieces = parseListPieces;
exports.parseScalarValue = parseScalarValue;
exports.parseValue = parseValue;

/**
 * Function deleting illegal characters from a potential tag name to avoid
 * generating invalid XML.
 *
 * @param  {string} type - Tag name.
 * @return {string}
 */
var SANITIZE_PATTERN = /["'<>&\s]/g;

exports.sanitizeTagName = function sanitizeTagName(tagName) {
  return tagName.replace(SANITIZE_PATTERN, '').trim();
};

},{}],4:[function(require,module,exports){
/* eslint no-self-compare: 0 */
/**
 * Graphology Browser GEXF Parser
 * ===============================
 *
 * Browser version of the graphology GEXF parser using DOMParser to function.
 */
var isGraphConstructor = require('graphology-utils/is-graph-constructor');
var mergeEdge = require('graphology-utils/add-edge').mergeEdge;
var helpers = require('../common/helpers.js');

var parseValue = helpers.parseValue;

/**
 * Function checking whether the given value is a NaN.
 *
 * @param  {any} value - Value to test.
 * @return {boolean}
 */
function isReallyNaN(value) {
  return value !== value;
}

/**
 * Function used to convert a viz:color attribute into a CSS rgba? or hex string.
 *
 * @param  {Node}   element - DOM element.
 * @return {string}
 */
function getVizColor(element) {
  var hex = element.getAttribute('hex');

  if (hex) {
    return hex;
  }

  var a = element.getAttribute('a');
  var r = element.getAttribute('r');
  var g = element.getAttribute('g');
  var b = element.getAttribute('b');

  return a
    ? 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
    : 'rgb(' + r + ',' + g + ',' + b + ')';
}

/**
 * Function returning the first matching tag of the `viz` namespace matching
 * the desired tag name.
 *
 * @param  {Node}   element - Target DOM element.
 * @param  {string} name    - Tag name.
 * @return {Node}
 */
function getFirstMatchingVizTag(element, name) {
  var vizElement = element.getElementsByTagName('viz:' + name)[0];

  if (!vizElement) vizElement = element.getElementsByTagNameNS('viz', name)[0];

  if (!vizElement) vizElement = element.getElementsByTagName(name)[0];

  return vizElement;
}

/**
 * Function used to collect meta information.
 *
 * @param  {Array<Node>} elements - Target DOM element.
 * @return {object}
 */
function collectMeta(elements) {
  var meta = {};
  var element;
  var value;

  for (var i = 0, l = elements.length; i < l; i++) {
    element = elements[i];

    if (element.nodeName === '#text') continue;

    value = element.textContent.trim();

    if (value) meta[element.tagName.toLowerCase()] = element.textContent;
  }

  return meta;
}

/**
 * Function used to extract the model from the right elements.
 *
 * @param  {Array<Node>} elements - Target DOM elements.
 * @return {array}                - The model & default attributes.
 */
function extractModel(elements) {
  var model = {};
  var defaults = {};
  var element;
  var defaultElement;
  var id;

  for (var i = 0, l = elements.length; i < l; i++) {
    element = elements[i];
    id = element.getAttribute('id') || element.getAttribute('for');

    model[id] = {
      id: id,
      type: element.getAttribute('type') || 'string',
      title: !isReallyNaN(+id) ? element.getAttribute('title') || id : id
    };

    // Default?
    defaultElement = element.getElementsByTagName('default')[0];

    if (defaultElement)
      defaults[model[id].title] = parseValue(
        model[id].type,
        defaultElement.textContent
      );
  }

  return [model, defaults];
}

/**
 * Function used to collect an element's attributes.
 *
 * @param  {object}  model    - Data model to use.
 * @param  {object}  defaults - Default values.
 * @param  {Node}    element  - Target DOM element.
 * @param  {boolean} allowUndeclaredAttributes - Whether to allow undeclared attributes.
 * @return {object}           - The collected attributes.
 */
function collectAttributes(
  model,
  defaults,
  element,
  allowUndeclaredAttributes
) {
  var data = {};
  var label = element.getAttribute('label');
  var weight = element.getAttribute('weight');
  var kind = element.getAttribute('kind');

  if (label) data.label = label;
  if (weight) data.weight = +weight;
  if (kind) data.kind = kind;

  var valueElements = element.getElementsByTagName('attvalue');
  var valueElement;
  var attr;
  var title;
  var value;
  var type;
  var id;

  for (var i = 0, l = valueElements.length; i < l; i++) {
    valueElement = valueElements[i];
    id = valueElement.getAttribute('id') || valueElement.getAttribute('for');
    value = valueElement.getAttribute('value');
    attr = model[id];

    if (!attr) {
      if (allowUndeclaredAttributes) {
        title = id;
        type = 'string';
      } else {
        throw new Error(
          'graphology-gexf/parser: Found undeclared attribute "' + id + '"'
        );
      }
    } else {
      title = attr.title;
      type = attr.type;
    }

    data[title] = parseValue(type, value);
  }

  // Applying default values
  var k;

  for (k in defaults) {
    if (!(k in data)) data[k] = defaults[k];
  }

  // TODO: shortcut here to avoid viz when namespace is not set

  // Attempting to find viz namespace tags

  //-- 1) Color
  var vizElement = getFirstMatchingVizTag(element, 'color');

  if (vizElement) data.color = getVizColor(vizElement);

  //-- 2) Size
  vizElement = getFirstMatchingVizTag(element, 'size');

  if (vizElement) data.size = +vizElement.getAttribute('value');

  //-- 3) Position
  var x, y, z;

  vizElement = getFirstMatchingVizTag(element, 'position');

  if (vizElement) {
    x = vizElement.getAttribute('x');
    y = vizElement.getAttribute('y');
    z = vizElement.getAttribute('z');

    if (x) data.x = +x;
    if (y) data.y = +y;
    if (z) data.z = +z;
  }

  //-- 4) Shape
  vizElement = getFirstMatchingVizTag(element, 'shape');

  if (vizElement) data.shape = vizElement.getAttribute('value');

  //-- 5) Thickness
  vizElement = getFirstMatchingVizTag(element, 'thickness');

  if (vizElement) data.thickness = +vizElement.getAttribute('value');

  return data;
}

/**
 * Factory taking implementations of `DOMParser` & `Document` returning
 * the parser function.
 */
module.exports = function createParserFunction(DOMParser, Document) {
  /**
   * Function taking either a string or a document and returning a
   * graphology instance.
   *
   * @param {function}        Graph  - A graphology constructor.
   * @param {string|Document} source - The source to parse.
   * @param {object}          options - Parsing options.
   */

  // TODO: option to map the data to the attributes for customization, nodeModel, edgeModel, nodeReducer, edgeReducer
  // TODO: option to disable the model mapping heuristic
  return function parse(Graph, source, options) {
    options = options || {};

    var addMissingNodes = options.addMissingNodes === true;
    var allowUndeclaredAttributes = options.allowUndeclaredAttributes === true;
    var respectInputGraphType = options.respectInputGraphType === true;
    var mergeResult;

    var xmlDoc = source;

    var element, result, type, attributes, id, s, t, i, l;

    if (!isGraphConstructor(Graph))
      throw new Error('graphology-gexf/parser: invalid Graph constructor.');

    // If source is a string, we are going to parse it
    if (typeof source === 'string')
      xmlDoc = new DOMParser().parseFromString(source, 'application/xml');

    if (!(xmlDoc instanceof Document))
      throw new Error(
        'graphology-gexf/parser: source should either be a XML document or a string.'
      );

    // Finding useful elements
    var GRAPH_ELEMENT = xmlDoc.getElementsByTagName('graph')[0];
    var META_ELEMENT = xmlDoc.getElementsByTagName('meta')[0];
    var META_ELEMENTS = (META_ELEMENT && META_ELEMENT.childNodes) || [];
    var NODE_ELEMENTS = xmlDoc.getElementsByTagName('node');
    var EDGE_ELEMENTS = xmlDoc.getElementsByTagName('edge');
    var MODEL_ELEMENTS = xmlDoc.getElementsByTagName('attributes');
    var NODE_MODEL_ELEMENTS = [];
    var EDGE_MODEL_ELEMENTS = [];

    for (i = 0, l = MODEL_ELEMENTS.length; i < l; i++) {
      element = MODEL_ELEMENTS[i];

      if (element.getAttribute('class') === 'node')
        NODE_MODEL_ELEMENTS = element.getElementsByTagName('attribute');
      else if (element.getAttribute('class') === 'edge')
        EDGE_MODEL_ELEMENTS = element.getElementsByTagName('attribute');
    }

    // Information
    var DEFAULT_EDGE_TYPE =
      GRAPH_ELEMENT.getAttribute('defaultedgetype') || 'undirected';

    if (DEFAULT_EDGE_TYPE === 'mutual') DEFAULT_EDGE_TYPE = 'undirected';

    // Computing models
    result = extractModel(NODE_MODEL_ELEMENTS);

    var NODE_MODEL = result[0];
    var NODE_DEFAULT_ATTRIBUTES = result[1];

    result = extractModel(EDGE_MODEL_ELEMENTS);

    var EDGE_MODEL = result[0];
    var EDGE_DEFAULT_ATTRIBUTES = result[1];

    // Polling the first edge to guess the type of the edges
    var graphType = EDGE_ELEMENTS[0]
      ? EDGE_ELEMENTS[0].getAttribute('type') || DEFAULT_EDGE_TYPE
      : 'mixed';

    // Instantiating our graph
    var graphOptions = respectInputGraphType ? {} : {type: graphType};

    var graph = new Graph(graphOptions);

    // Collecting meta
    var meta = collectMeta(META_ELEMENTS);
    var lastModifiedDate =
      META_ELEMENT && META_ELEMENT.getAttribute('lastmodifieddate');

    graph.replaceAttributes(meta);

    if (lastModifiedDate)
      graph.setAttribute('lastModifiedDate', lastModifiedDate);

    // Adding nodes
    for (i = 0, l = NODE_ELEMENTS.length; i < l; i++) {
      element = NODE_ELEMENTS[i];

      graph.addNode(
        element.getAttribute('id'),
        collectAttributes(
          NODE_MODEL,
          NODE_DEFAULT_ATTRIBUTES,
          element,
          allowUndeclaredAttributes
        )
      );
    }

    // Adding edges
    for (i = 0, l = EDGE_ELEMENTS.length; i < l; i++) {
      element = EDGE_ELEMENTS[i];

      id = element.getAttribute('id');
      type = element.getAttribute('type') || DEFAULT_EDGE_TYPE;
      s = element.getAttribute('source');
      t = element.getAttribute('target');
      attributes = collectAttributes(
        EDGE_MODEL,
        EDGE_DEFAULT_ATTRIBUTES,
        element,
        allowUndeclaredAttributes
      );

      // If we encountered an edge with a different type, we upgrade the graph
      if (type !== graph.type && graph.type !== 'mixed') {
        if (respectInputGraphType)
          throw new Error(
            "graphology-gexf/parser: one of the file's edges does not respect the input graph type: " +
              graph.type +
              '.'
          );

        graph = graph.copy({type: 'mixed'});
      }

      // If we encountered twice the same edge, we upgrade the graph
      if (
        !graph.multi &&
        ((type === 'directed' && graph.hasDirectedEdge(s, t)) ||
          graph.hasUndirectedEdge(s, t))
      ) {
        if (respectInputGraphType)
          throw new Error(
            'graphology-gexf/parser: the file contains parallel edges that the input graph type does not allow.'
          );

        graph = graph.copy({multi: true});
      }

      mergeResult = mergeEdge(
        graph,
        type !== 'directed',
        id || null,
        s,
        t,
        attributes
      );

      if (!addMissingNodes && (mergeResult[2] || mergeResult[3])) {
        throw new Error(
          'graphology-gexf/parser: one of your gexf file edges points to an inexisting node. Set the parser `addMissingNodes` option to `true` if you do not care.'
        );
      }
    }

    return graph;
  };
};

},{"../common/helpers.js":3,"graphology-utils/add-edge":6,"graphology-utils/is-graph-constructor":8}],5:[function(require,module,exports){
/* eslint no-self-compare: 0 */
/**
 * Graphology Common GEXF Writer
 * ==============================
 *
 * GEXF writer working for both node.js & the browser.
 */
var isGraph = require('graphology-utils/is-graph');
var inferType = require('graphology-utils/infer-type');
var XMLWriter = require('xml-writer');
var sanitizeTagName = require('./helpers.js').sanitizeTagName;

/**
 * Constants.
 */
var VIZ_RESERVED_NAMES = new Set([
  'color',
  'size',
  'x',
  'y',
  'z',
  'shape',
  'thickness'
]);

var RGBA_TEST = /^\s*rgba?\s*\(/i;
var RGBA_MATCH =
  /^\s*rgba?\s*\(\s*([0-9]*)\s*,\s*([0-9]*)\s*,\s*([0-9]*)\s*(?:,\s*([.0-9]*))?\)\s*$/;

/**
 * Function used to transform a CSS color into a RGBA object.
 *
 * @param  {string} value - Target value.
 * @return {object}
 */
function CSSColorToRGBA(value) {
  if (!value || typeof value !== 'string') return {};

  if (value[0] === '#') {
    value = value.slice(1);

    return value.length === 3
      ? {
          r: parseInt(value[0] + value[0], 16),
          g: parseInt(value[1] + value[1], 16),
          b: parseInt(value[2] + value[2], 16)
        }
      : {
          r: parseInt(value[0] + value[1], 16),
          g: parseInt(value[2] + value[3], 16),
          b: parseInt(value[4] + value[5], 16)
        };
  } else if (RGBA_TEST.test(value)) {
    var result = {};

    value = value.match(RGBA_MATCH);
    result.r = +value[1];
    result.g = +value[2];
    result.b = +value[3];

    if (value[4]) result.a = +value[4];

    return result;
  }

  return {};
}

/**
 * Function used to map an element's attributes to a standardized map of
 * GEXF expected properties (label, viz, attributes).
 *
 * @param  {string} type       - The element's type.
 * @param  {string} key        - The element's key.
 * @param  {object} attributes - The element's attributes.
 * @return {object}
 */
function DEFAULT_ELEMENT_FORMATTER(type, key, attributes) {
  var output = {},
    name;

  for (name in attributes) {
    if (name === 'label') {
      output.label = attributes.label;
    } else if (type === 'edge' && name === 'weight') {
      output.weight = attributes.weight;
    } else if (type === 'edge' && name === 'kind') {
      output.kind = attributes.kind;
    } else if (VIZ_RESERVED_NAMES.has(name)) {
      output.viz = output.viz || {};
      output.viz[name] = attributes[name];
    } else {
      output.attributes = output.attributes || {};
      output.attributes[name] = attributes[name];
    }
  }

  return output;
}

var DEFAULT_NODE_FORMATTER = DEFAULT_ELEMENT_FORMATTER.bind(null, 'node');
var DEFAULT_EDGE_FORMATTER = DEFAULT_ELEMENT_FORMATTER.bind(null, 'edge');

/**
 * Function used to check whether the given integer is 32 bits or not.
 *
 * @param  {number} number - Target number.
 * @return {boolean}
 */
function is32BitInteger(number) {
  return number <= 0x7fffffff && number >= -0x7fffffff;
}

/**
 * Function used to check whether the given value is "empty".
 *
 * @param  {any} value - Target value.
 * @return {boolean}
 */
function isEmptyValue(value) {
  return (
    typeof value === 'undefined' ||
    value === null ||
    value === '' ||
    value !== value
  );
}

var TYPE_PRIORITIES = {
  liststring: 0,
  listdouble: 1,
  listlong: 2,
  listinteger: 3,
  listboolean: 4,
  string: 5,
  double: 6,
  long: 7,
  integer: 8,
  boolean: 9,
  empty: 10
};

/**
 * Function used to detect a JavaScript's value type in the GEXF model.
 *
 * @param  {any}    value - Target value.
 * @return {string}
 */
function inferScalarValueType(value) {
  if (isEmptyValue(value)) return 'empty';

  if (typeof value === 'boolean') return 'boolean';

  if (typeof value === 'object') return 'string';

  // Numbers
  if (typeof value === 'number') {
    // Integer
    if (value === (value | 0)) {
      // Long (JavaScript integer can go up to 53 bit)?
      return is32BitInteger(value) ? 'integer' : 'long';
    }

    // JavaScript numbers are 64 bit float, hence the double
    return 'double';
  }

  return 'string';
}

function inferListValueType(values) {
  var type = 'empty';
  var priority = TYPE_PRIORITIES[type];
  var value, t, p;

  for (var i = 0, l = values.length; i < l; i++) {
    value = values[i];
    t = inferScalarValueType(value);
    p = TYPE_PRIORITIES[t];

    if (p < priority) {
      type = t;
      priority = p;
    }
  }

  return type;
}

function inferValueType(value) {
  // NOTE: at some point we might need a frame-independent test for this...
  // NOTE: it would be nice not to have to reallocate the Set as an Array
  // but good enough for the time being.
  if (value instanceof Set) {
    value = Array.from(value);
  }

  if (Array.isArray(value)) {
    var type = inferListValueType(value);

    if (type === 'empty') return 'empty';

    return 'list' + type;
  }

  return inferScalarValueType(value);
}

var TO_SANITIZE_PATTERN = /[\r\t\n]/g;

var SINGLE_QUOTE = "'";
var DOUBLE_QUOTE = '"';

function serializeValue(type, value) {
  if (type !== 'string' || TO_SANITIZE_PATTERN.test(value)) {
    return JSON.stringify(value);
  }

  if (!value.includes(SINGLE_QUOTE)) {
    if (!value.includes(DOUBLE_QUOTE)) {
      return value;
    }
    return SINGLE_QUOTE + value + SINGLE_QUOTE;
  }

  return JSON.stringify(value);
}

/**
 * Function used to cast the given value into the given type.
 *
 * @param  {string} type  - Target type.
 * @param  {any}    value - Value to cast.
 * @return {string}
 */
function cast(version, type, value) {
  if (type.startsWith('list')) {
    if (value instanceof Set) value = Array.from(value);
    var arrayValue = Array.isArray(value) ? value : [value];

    var subtype = type.slice(4);
    if (version === '1.3') {
      return (
        '[' +
        arrayValue
          .map(function (v) {
            return serializeValue(subtype, v);
          })
          .join(', ') +
        ']'
      );
    } else {
      return arrayValue.join('|');
    }
  }

  return '' + value;
}

/**
 * Function used to collect data from a graph's nodes.
 *
 * @param  {Graph}    graph   - Target graph.
 * @param  {function} format  - Function formatting the nodes attributes.
 * @return {array}
 */
function collectNodeData(graph, format) {
  var nodes = new Array(graph.order);
  var i = 0;

  graph.forEachNode(function (node, attr) {
    var data = format(node, attr);
    data.key = node;
    nodes[i++] = data;
  });

  return nodes;
}

/**
 * Function used to collect data from a graph's edges.
 *
 * @param  {Graph}    graph   - Target graph.
 * @param  {function} reducer - Function reducing the edges attributes.
 * @return {array}
 */
function collectEdgeData(graph, reducer) {
  var edges = new Array(graph.size);
  var i = 0;

  graph.forEachEdge(function (
    edge,
    attr,
    source,
    target,
    _sa,
    _ta,
    undirected
  ) {
    var data = reducer(edge, attr);
    data.key = edge;
    data.source = source;
    data.target = target;
    data.undirected = undirected;
    edges[i++] = data;
  });

  return edges;
}

/**
 * Function used to infer the model of the graph's nodes or edges.
 *
 * @param  {array} elements - The graph's relevant elements.
 * @return {array}
 */

// TODO: on large graph, we could also sample or let the user indicate the types
function inferModel(elements) {
  var model = {};
  var attributes;
  var type, currentType;
  var k;

  // Testing every attributes
  for (var i = 0, l = elements.length; i < l; i++) {
    attributes = elements[i].attributes;

    if (!attributes) continue;

    for (k in attributes) {
      type = inferValueType(attributes[k]);

      if (type === 'empty') continue;

      currentType = model[k];

      if (!currentType) model[k] = type;
      else {
        if (
          type !== currentType &&
          TYPE_PRIORITIES[type] < TYPE_PRIORITIES[currentType]
        ) {
          model[k] = type;
        }
      }
    }
  }

  // TODO: check default values
  return model;
}

/**
 * Function used to write a model.
 *
 * @param {XMLWriter} writer     - The writer to use.
 * @param {object}    model      - Model to write.
 * @param {string}    modelClass - Class of the model.
 */
function writeModel(writer, model, modelClass) {
  var name;

  if (!Object.keys(model).length) return;

  writer.startElement('attributes');
  writer.writeAttribute('class', modelClass);

  for (name in model) {
    writer.startElement('attribute');
    writer.writeAttribute('id', name);
    writer.writeAttribute('title', name);
    writer.writeAttribute('type', model[name]);
    writer.endElement();
  }

  writer.endElement();
}

function writeElements(version, writer, type, model, elements) {
  var emptyModel = !Object.keys(model).length;
  var element;
  var name;
  var color;
  var value;
  var edgeType;
  var attributes;
  var weight;
  var viz;
  var k;
  var i;
  var l;

  writer.startElement(type + 's');

  for (i = 0, l = elements.length; i < l; i++) {
    element = elements[i];
    attributes = element.attributes;
    viz = element.viz;

    writer.startElement(type);
    writer.writeAttribute('id', element.key);

    if (type === 'edge') {
      edgeType = element.undirected ? 'undirected' : 'directed';

      if (edgeType !== writer.defaultEdgeType)
        writer.writeAttribute('type', edgeType);

      writer.writeAttribute('source', element.source);
      writer.writeAttribute('target', element.target);

      weight = element.weight;

      if (
        (typeof weight === 'number' && !isNaN(weight)) ||
        typeof weight === 'string'
      )
        writer.writeAttribute('weight', element.weight);

      if (element.kind) {
        writer.writeAttribute('kind', element.kind);
      }
    }

    if (element.label) writer.writeAttribute('label', element.label);

    if (!emptyModel && attributes) {
      writer.startElement('attvalues');

      for (name in model) {
        if (name in attributes) {
          value = attributes[name];

          if (isEmptyValue(value)) continue;

          writer.startElement('attvalue');
          writer.writeAttribute('for', name);
          writer.writeAttribute('value', cast(version, model[name], value));
          writer.endElement();
        }
      }

      writer.endElement();
    }

    if (viz) {
      //-- 1) Color
      if (viz.color) {
        writer.startElementNS('viz', 'color');

        if (version === '1.3' && viz.color.startsWith('#')) {
          writer.writeAttribute('hex', viz.color);
        } else {
          color = CSSColorToRGBA(viz.color);

          for (k in color) writer.writeAttribute(k, color[k]);
        }
        writer.endElement();
      }

      //-- 2) Size
      if (viz.size !== undefined) {
        writer.startElementNS('viz', 'size');
        writer.writeAttribute('value', viz.size);
        writer.endElement();
      }

      //-- 3) Position
      if (viz.x !== undefined || viz.y !== undefined || viz.z !== undefined) {
        writer.startElementNS('viz', 'position');

        if (viz.x !== undefined) writer.writeAttribute('x', viz.x);

        if (viz.y !== undefined) writer.writeAttribute('y', viz.y);

        if (viz.z !== undefined) writer.writeAttribute('z', viz.z);

        writer.endElement();
      }

      //-- 4) Shape
      if (viz.shape) {
        writer.startElementNS('viz', 'shape');
        writer.writeAttribute('value', viz.shape);
        writer.endElement();
      }

      //-- 5) Thickness
      if (viz.thickness !== undefined) {
        writer.startElementNS('viz', 'thickness');
        writer.writeAttribute('value', viz.thickness);
        writer.endElement();
      }
    }

    writer.endElement();
  }

  writer.endElement();
}

/**
 * Defaults.
 */
var DEFAULTS = {
  encoding: 'UTF-8',
  pretty: true,
  version: '1.2',
  pedantic: false,
  formatNode: DEFAULT_NODE_FORMATTER,
  formatEdge: DEFAULT_EDGE_FORMATTER
};

/**
 * Function taking a graphology instance & outputting a gexf string.
 *
 * @param  {Graph}  graph        - Target graphology instance.
 * @param  {object} options      - Options:
 * @param  {string}   [encoding]   - Character encoding.
 * @param  {boolean}  [pretty]     - Whether to pretty print output.
 * @param  {string}   [version]    - Gexf version to emit.
 * @param  {boolean}  [pedantic]   - Pedantic output?
 * @param  {function} [formatNode] - Function formatting nodes' output.
 * @param  {function} [formatEdge] - Function formatting edges' output.
 * @return {string}              - GEXF string.
 */
module.exports = function write(graph, options) {
  if (!isGraph(graph))
    throw new Error('graphology-gexf/writer: invalid graphology instance.');

  options = options || {};

  var indent = options.pretty === false ? false : '  ';
  var pedantic = options.pedantic === true;

  var formatNode = options.formatNode || DEFAULTS.formatNode;
  var formatEdge = options.formatEdge || DEFAULTS.formatEdge;

  var writer = new XMLWriter(indent);

  writer.startDocument('1.0', options.encoding || DEFAULTS.encoding);

  // Starting gexf
  var version = options.version || DEFAULTS.version;

  if (version !== '1.2' && version !== '1.3') {
    throw new Error(
      'graphology-gexf/writer: invalid gexf version "' +
        version +
        '". Expecting 1.2 or 1.3.'
    );
  }

  writer.startElement('gexf');
  writer.writeAttribute('version', version);

  if (version === '1.2') {
    writer.writeAttribute('xmlns', 'http://www.gexf.net/1.2draft');
    writer.writeAttribute('xmlns:viz', 'http:///www.gexf.net/1.1draft/viz');
  } else if (version === '1.3') {
    writer.writeAttribute('xmlns', 'http://gexf.net/1.3');
    writer.writeAttribute('xmlns:viz', 'http://gexf.net/1.3/viz');
    writer.writeAttribute(
      'xmlns:xsi',
      'http://www.w3.org/2001/XMLSchema-instance'
    );
    writer.writeAttribute(
      'xsi:schemaLocation',
      'http://gexf.net/1.3 http://gexf.net/1.3/gexf.xsd'
    );
  }

  // Processing meta
  writer.startElement('meta');
  var graphAttributes = graph.getAttributes();

  if (graphAttributes.lastModifiedDate)
    writer.writeAttribute('lastmodifieddate', graphAttributes.lastModifiedDate);

  var metaTagName;
  var graphAttribute;

  for (var k in graphAttributes) {
    if (k === 'lastModifiedDate') continue;

    if (pedantic && k !== 'creator' && k !== 'description' && k !== 'keywords')
      continue;

    metaTagName = sanitizeTagName(k);

    if (!metaTagName) continue;

    graphAttribute = graphAttributes[k];

    // NOTE: if the graph attribute is not a scalar, we do not bother writing
    // it as metadata in the gexf output. This means the writer/parser is not
    // idempotent, but we cannot do better because the gexf format does not
    // allow it, since it was not meant to handle complex values as graph
    // metadata anyway.
    if (
      typeof graphAttribute === 'string' ||
      typeof graphAttribute === 'number' ||
      typeof graphAttribute === 'boolean'
    ) {
      writer.writeElement(metaTagName, '' + graphAttribute);
    }
  }

  writer.endElement();
  writer.startElement('graph');

  var type = inferType(graph);

  writer.defaultEdgeType = type === 'mixed' ? 'directed' : type;

  writer.writeAttribute('defaultedgetype', writer.defaultEdgeType);

  // Processing model
  var nodes = collectNodeData(graph, formatNode);
  var edges = collectEdgeData(graph, formatEdge);

  var nodeModel = inferModel(nodes);

  writeModel(writer, nodeModel, 'node');

  var edgeModel = inferModel(edges);

  writeModel(writer, edgeModel, 'edge');

  // Processing nodes
  writeElements(version, writer, 'node', nodeModel, nodes);

  // Processing edges
  writeElements(version, writer, 'edge', edgeModel, edges);

  return writer.toString();
};

},{"./helpers.js":3,"graphology-utils/infer-type":7,"graphology-utils/is-graph":9,"xml-writer":10}],6:[function(require,module,exports){
/**
 * Graphology Edge Adders
 * =======================
 *
 * Generic edge addition functions that can be used to avoid nasty repetitive
 * conditions.
 */
exports.addEdge = function addEdge(
  graph,
  undirected,
  key,
  source,
  target,
  attributes
) {
  if (undirected) {
    if (key === null || key === undefined)
      return graph.addUndirectedEdge(source, target, attributes);
    else return graph.addUndirectedEdgeWithKey(key, source, target, attributes);
  } else {
    if (key === null || key === undefined)
      return graph.addDirectedEdge(source, target, attributes);
    else return graph.addDirectedEdgeWithKey(key, source, target, attributes);
  }
};

exports.copyEdge = function copyEdge(
  graph,
  undirected,
  key,
  source,
  target,
  attributes
) {
  attributes = Object.assign({}, attributes);

  if (undirected) {
    if (key === null || key === undefined)
      return graph.addUndirectedEdge(source, target, attributes);
    else return graph.addUndirectedEdgeWithKey(key, source, target, attributes);
  } else {
    if (key === null || key === undefined)
      return graph.addDirectedEdge(source, target, attributes);
    else return graph.addDirectedEdgeWithKey(key, source, target, attributes);
  }
};

exports.mergeEdge = function mergeEdge(
  graph,
  undirected,
  key,
  source,
  target,
  attributes
) {
  if (undirected) {
    if (key === null || key === undefined)
      return graph.mergeUndirectedEdge(source, target, attributes);
    else
      return graph.mergeUndirectedEdgeWithKey(key, source, target, attributes);
  } else {
    if (key === null || key === undefined)
      return graph.mergeDirectedEdge(source, target, attributes);
    else return graph.mergeDirectedEdgeWithKey(key, source, target, attributes);
  }
};

exports.updateEdge = function updateEdge(
  graph,
  undirected,
  key,
  source,
  target,
  updater
) {
  if (undirected) {
    if (key === null || key === undefined)
      return graph.updateUndirectedEdge(source, target, updater);
    else return graph.updateUndirectedEdgeWithKey(key, source, target, updater);
  } else {
    if (key === null || key === undefined)
      return graph.updateDirectedEdge(source, target, updater);
    else return graph.updateDirectedEdgeWithKey(key, source, target, updater);
  }
};

},{}],7:[function(require,module,exports){
/**
 * Graphology inferType
 * =====================
 *
 * Useful function used to "guess" the real type of the given Graph using
 * introspection.
 */
var isGraph = require('./is-graph.js');

/**
 * Returning the inferred type of the given graph.
 *
 * @param  {Graph}   graph - Target graph.
 * @return {boolean}
 */
module.exports = function inferType(graph) {
  if (!isGraph(graph))
    throw new Error(
      'graphology-utils/infer-type: expecting a valid graphology instance.'
    );

  var declaredType = graph.type;

  if (declaredType !== 'mixed') return declaredType;

  if (
    (graph.directedSize === 0 && graph.undirectedSize === 0) ||
    (graph.directedSize > 0 && graph.undirectedSize > 0)
  )
    return 'mixed';

  if (graph.directedSize > 0) return 'directed';

  return 'undirected';
};

},{"./is-graph.js":9}],8:[function(require,module,exports){
/**
 * Graphology isGraphConstructor
 * ==============================
 *
 * Very simple function aiming at ensuring the given variable is a
 * graphology constructor.
 */

/**
 * Checking the value is a graphology constructor.
 *
 * @param  {any}     value - Target value.
 * @return {boolean}
 */
module.exports = function isGraphConstructor(value) {
  return (
    value !== null &&
    typeof value === 'function' &&
    typeof value.prototype === 'object' &&
    typeof value.prototype.addUndirectedEdgeWithKey === 'function' &&
    typeof value.prototype.dropNode === 'function'
  );
};

},{}],9:[function(require,module,exports){
/**
 * Graphology isGraph
 * ===================
 *
 * Very simple function aiming at ensuring the given variable is a
 * graphology instance.
 */

/**
 * Checking the value is a graphology instance.
 *
 * @param  {any}     value - Target value.
 * @return {boolean}
 */
module.exports = function isGraph(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.addUndirectedEdgeWithKey === 'function' &&
    typeof value.dropNode === 'function' &&
    typeof value.multi === 'boolean'
  );
};

},{}],10:[function(require,module,exports){
module.exports = require('./lib/xml-writer.js');

},{"./lib/xml-writer.js":11}],11:[function(require,module,exports){

function isFalse(s) {
  return typeof s !== 'number' && !s;
}

function strval(s) {
  if (typeof s == 'string') {
    return s;
  }
  else if (typeof s == 'number') {
    return s+'';
  }
  else if (typeof s == 'function') {
    return s();
  }
  else if (s instanceof XMLWriter) {
    return s.toString();
  }
  else throw Error('Bad Parameter');
}

function XMLWriter(indent, callback) {

    if (!(this instanceof XMLWriter)) {
        return new XMLWriter();
    }

    this.name_regex = /[_:A-Za-z][-._:A-Za-z0-9]*/;
    this.indent = indent ? true : false;
    this.indentString = this.indent && typeof indent === 'string' ? indent : '    ';
    this.output = '';
    this.stack = [];
    this.tags = 0;
    this.attributes = 0;
    this.attribute = 0;
    this.texts = 0;
    this.comment = 0;
    this.dtd = 0;
    this.root = '';
    this.pi = 0;
    this.cdata = 0;
    this.started_write = false;
    this.writer;
    this.writer_encoding = 'UTF-8';

    if (typeof callback == 'function') {
        this.writer = callback;
    } else {
        this.writer = function (s, e) {
            this.output += s;
        }
    }
}

XMLWriter.prototype = {
    toString : function () {
        this.flush();
        return this.output;
    },

    indenter : function () {
      if (this.indent) {
        this.write('\n');
        for (var i = 1; i < this.tags; i++) {
          this.write(this.indentString);
        }
      }
    },

    write : function () {
        for (var i = 0; i < arguments.length; i++) {
            this.writer(arguments[i], this.writer_encoding);
        }
    },


    flush : function () {
        for (var i = this.tags; i > 0; i--) {
            this.endElement();
        }
        this.tags = 0;
    },

    startDocument : function (version, encoding, standalone) {
        if (this.tags || this.attributes) return this;

        this.startPI('xml');
        this.startAttribute('version');
        this.text(typeof version == "string" ? version : "1.0");
        this.endAttribute();
        if (typeof encoding == "string") {
            this.startAttribute('encoding');
            this.text(encoding);
            this.endAttribute();
            this.writer_encoding = encoding;
        }
        if (standalone) {
            this.startAttribute('standalone');
            this.text("yes");
            this.endAttribute();
        }
        this.endPI();
        if (!this.indent) {
          this.write('\n');
        }
        return this;
    },

    endDocument : function () {
        if (this.attributes) this.endAttributes();
        return this;
    },

    writeElement : function (name, content) {
        return this.startElement(name).text(content).endElement();
    },

    writeElementNS : function (prefix, name, uri, content) {
        if (!content) {
            content = uri;
        }
        return this.startElementNS(prefix, name, uri).text(content).endElement();
    },

    startElement : function (name) {
        name = strval(name);
        if (!name.match(this.name_regex)) throw Error('Invalid Parameter');
        if (this.tags === 0 && this.root && this.root !== name) throw Error('Invalid Parameter');
        if (this.attributes) this.endAttributes();
        ++this.tags;
        this.texts = 0;
        if (this.stack.length > 0)
          this.stack[this.stack.length-1].containsTag = true;

        this.stack.push({
            name: name,
            tags: this.tags
        });
        if (this.started_write) this.indenter();
        this.write('<', name);
        this.startAttributes();
        this.started_write = true;
        return this;
    },
    startElementNS : function (prefix, name, uri) {
        prefix = strval(prefix);
        name = strval(name);

        if (!prefix.match(this.name_regex)) throw Error('Invalid Parameter');
        if (!name.match(this.name_regex)) throw Error('Invalid Parameter');
        if (this.attributes) this.endAttributes();
        ++this.tags;
        this.texts = 0;
        if (this.stack.length > 0)
          this.stack[this.stack.length-1].containsTag = true;

        this.stack.push({
            name: prefix + ':' + name,
            tags: this.tags
        });
        if (this.started_write) this.indenter();
        this.write('<', prefix + ':' + name);
        this.startAttributes();
        this.started_write = true;
        return this;
    },

    endElement : function () {
        if (!this.tags) return this;
        var t = this.stack.pop();
        if (this.attributes > 0) {
            if (this.attribute) {
                if (this.texts) this.endAttribute();
                this.endAttribute();
            }
            this.write('/');
            this.endAttributes();
        } else {
            if (t.containsTag) this.indenter();
            this.write('</', t.name, '>');
        }
        --this.tags;
        this.texts = 0;
        return this;
    },

    writeAttribute : function (name, content) {
        if (typeof content == 'function') {
          content = content();
        }
        if (isFalse(content)) {
           return this;
        }
        return this.startAttribute(name).text(content).endAttribute();
    },
    writeAttributeNS : function (prefix, name, uri, content) {
        if (!content) {
            content = uri;
        }
        if (typeof content == 'function') {
          content = content();
        }
        if (isFalse(content)) {
          return this;
        }
        return this.startAttributeNS(prefix, name, uri).text(content).endAttribute();
    },

    startAttributes : function () {
        this.attributes = 1;
        return this;
    },

    endAttributes : function () {
        if (!this.attributes) return this;
        if (this.attribute) this.endAttribute();
        this.attributes = 0;
        this.attribute = 0;
        this.texts = 0;
        this.write('>');
        return this;
    },

    startAttribute : function (name) {
        name = strval(name);
        if (!name.match(this.name_regex)) throw Error('Invalid Parameter');
        if (!this.attributes && !this.pi) return this;
        if (this.attribute) return this;
        this.attribute = 1;
        this.write(' ', name, '="');
        return this;
    },
    startAttributeNS : function (prefix, name, uri) {
        prefix = strval(prefix);
        name = strval(name);

        if (!prefix.match(this.name_regex)) throw Error('Invalid Parameter');
        if (!name.match(this.name_regex)) throw Error('Invalid Parameter');
        if (!this.attributes && !this.pi) return this;
        if (this.attribute) return this;
        this.attribute = 1;
        this.write(' ', prefix + ':' + name, '="');
        return this;
    },
    endAttribute : function () {
        if (!this.attribute) return this;
        this.attribute = 0;
        this.texts = 0;
        this.write('"');
        return this;
    },

    text : function (content) {
        content = strval(content);
        if (!this.tags && !this.comment && !this.pi && !this.cdata) return this;
        if (this.attributes && this.attribute) {
            ++this.texts;
            this.write(content
                       .replace(/&/g, '&amp;')
                       .replace(/</g, '&lt;')
                       .replace(/"/g, '&quot;')
                       .replace(/\t/g, '&#x9;')
                       .replace(/\n/g, '&#xA;')
                       .replace(/\r/g, '&#xD;')
                      );
            return this;
        } else if (this.attributes && !this.attribute) {
            this.endAttributes();
        }
        if (this.comment || this.cdata) {
            this.write(content);
        }
        else {
          this.write(content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        }
        ++this.texts;
        this.started_write = true;
        return this;
    },

    writeComment : function (content) {
        return this.startComment().text(content).endComment();
    },

    startComment : function () {
        if (this.comment) return this;
        if (this.attributes) this.endAttributes();
        this.indenter();
        this.write('<!--');
        this.comment = 1;
        this.started_write = true;
        return this;
    },

    endComment : function () {
        if (!this.comment) return this;
        this.write('-->');
        this.comment = 0;
        return this;
    },

    writeDocType : function (name, pubid, sysid, subset) {
        return this.startDocType(name, pubid, sysid, subset).endDocType()
    },

    startDocType : function (name, pubid, sysid, subset) {
        if (this.dtd || this.tags) return this;

        name = strval(name);
        pubid = pubid ? strval(pubid) : pubid;
        sysid = sysid ? strval(sysid) : sysid;
        subset = subset ? strval(subset) : subset;

        if (!name.match(this.name_regex)) throw Error('Invalid Parameter');
        if (pubid && !pubid.match(/^[\w\-][\w\s\-\/\+\:\.]*/)) throw Error('Invalid Parameter');
        if (sysid && !sysid.match(/^[\w\.][\w\-\/\\\:\.]*/)) throw Error('Invalid Parameter');
        if (subset && !subset.match(/[\w\s\<\>\+\.\!\#\-\?\*\,\(\)\|]*/)) throw Error('Invalid Parameter');

        pubid = pubid ? ' PUBLIC "' + pubid + '"' : (sysid) ? ' SYSTEM' : '';
        sysid = sysid ? ' "' + sysid + '"' : '';
        subset = subset ? ' [' + subset + ']': '';

        if (this.started_write) this.indenter();
        this.write('<!DOCTYPE ', name, pubid, sysid, subset);
        this.root = name;
        this.dtd = 1;
        this.started_write = true;
        return this;
    },

    endDocType : function () {
        if (!this.dtd) return this;
        this.write('>');
        return this;
    },

    writePI : function (name, content) {
        return this.startPI(name).text(content).endPI()
    },

    startPI : function (name) {
        name = strval(name);
        if (!name.match(this.name_regex)) throw Error('Invalid Parameter');
        if (this.pi) return this;
        if (this.attributes) this.endAttributes();
        if (this.started_write) this.indenter();
        this.write('<?', name);
        this.pi = 1;
        this.started_write = true;
        return this;
    },

    endPI : function () {
        if (!this.pi) return this;
        this.write('?>');
        this.pi = 0;
        return this;
    },

    writeCData : function (content) {
        return this.startCData().text(content).endCData();
    },

    startCData : function () {
        if (this.cdata) return this;
        if (this.attributes) this.endAttributes();
        this.indenter();
        this.write('<![CDATA[');
        this.cdata = 1;
        this.started_write = true;
        return this;
    },

    endCData : function () {
        if (!this.cdata) return this;
        this.write(']]>');
        this.cdata = 0;
        return this;
    },

    writeRaw : function(content) {
        content = strval(content);
        if (!this.tags && !this.comment && !this.pi && !this.cdata) return this;
        if (this.attributes && this.attribute) {
            ++this.texts;
            this.write(content.replace('&', '&amp;').replace('"', '&quot;'));
            return this;
        } else if (this.attributes && !this.attribute) {
            this.endAttributes();
        }
        ++this.texts;
        this.write(content);
        this.started_write = true;
        return this;
    }

}

module.exports = XMLWriter;

},{}]},{},[1])(1)
});
