/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import $protobuf from "protobufjs/minimal.js";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const scala = $root.scala = (() => {

    /**
     * Namespace scala.
     * @exports scala
     * @namespace
     */
    const scala = {};

    scala.meta = (function() {

        /**
         * Namespace meta.
         * @memberof scala
         * @namespace
         */
        const meta = {};

        meta.internal = (function() {

            /**
             * Namespace internal.
             * @memberof scala.meta
             * @namespace
             */
            const internal = {};

            internal.semanticdb = (function() {

                /**
                 * Namespace semanticdb.
                 * @memberof scala.meta.internal
                 * @namespace
                 */
                const semanticdb = {};

                /**
                 * Schema enum.
                 * @name scala.meta.internal.semanticdb.Schema
                 * @enum {number}
                 * @property {number} LEGACY=0 LEGACY value
                 * @property {number} SEMANTICDB3=3 SEMANTICDB3 value
                 * @property {number} SEMANTICDB4=4 SEMANTICDB4 value
                 */
                semanticdb.Schema = (function() {
                    const valuesById = {}, values = Object.create(valuesById);
                    values[valuesById[0] = "LEGACY"] = 0;
                    values[valuesById[3] = "SEMANTICDB3"] = 3;
                    values[valuesById[4] = "SEMANTICDB4"] = 4;
                    return values;
                })();

                semanticdb.TextDocuments = (function() {

                    /**
                     * Properties of a TextDocuments.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ITextDocuments
                     * @property {Array.<scala.meta.internal.semanticdb.ITextDocument>|null} [documents] TextDocuments documents
                     */

                    /**
                     * Constructs a new TextDocuments.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a TextDocuments.
                     * @implements ITextDocuments
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ITextDocuments=} [properties] Properties to set
                     */
                    function TextDocuments(properties) {
                        this.documents = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * TextDocuments documents.
                     * @member {Array.<scala.meta.internal.semanticdb.ITextDocument>} documents
                     * @memberof scala.meta.internal.semanticdb.TextDocuments
                     * @instance
                     */
                    TextDocuments.prototype.documents = $util.emptyArray;

                    /**
                     * Creates a new TextDocuments instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.TextDocuments
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITextDocuments=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.TextDocuments} TextDocuments instance
                     */
                    TextDocuments.create = function create(properties) {
                        return new TextDocuments(properties);
                    };

                    /**
                     * Encodes the specified TextDocuments message. Does not implicitly {@link scala.meta.internal.semanticdb.TextDocuments.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.TextDocuments
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITextDocuments} message TextDocuments message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    TextDocuments.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.documents != null && message.documents.length)
                            for (let i = 0; i < message.documents.length; ++i)
                                $root.scala.meta.internal.semanticdb.TextDocument.encode(message.documents[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified TextDocuments message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.TextDocuments.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.TextDocuments
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITextDocuments} message TextDocuments message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    TextDocuments.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a TextDocuments message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.TextDocuments
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.TextDocuments} TextDocuments
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    TextDocuments.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.TextDocuments();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    if (!(message.documents && message.documents.length))
                                        message.documents = [];
                                    message.documents.push($root.scala.meta.internal.semanticdb.TextDocument.decode(reader, reader.uint32()));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a TextDocuments message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.TextDocuments
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.TextDocuments} TextDocuments
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    TextDocuments.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a TextDocuments message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.TextDocuments
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    TextDocuments.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.documents != null && message.hasOwnProperty("documents")) {
                            if (!Array.isArray(message.documents))
                                return "documents: array expected";
                            for (let i = 0; i < message.documents.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.TextDocument.verify(message.documents[i]);
                                if (error)
                                    return "documents." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates a TextDocuments message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.TextDocuments
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.TextDocuments} TextDocuments
                     */
                    TextDocuments.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.TextDocuments)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.TextDocuments();
                        if (object.documents) {
                            if (!Array.isArray(object.documents))
                                throw TypeError(".scala.meta.internal.semanticdb.TextDocuments.documents: array expected");
                            message.documents = [];
                            for (let i = 0; i < object.documents.length; ++i) {
                                if (typeof object.documents[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.TextDocuments.documents: object expected");
                                message.documents[i] = $root.scala.meta.internal.semanticdb.TextDocument.fromObject(object.documents[i]);
                            }
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a TextDocuments message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.TextDocuments
                     * @static
                     * @param {scala.meta.internal.semanticdb.TextDocuments} message TextDocuments
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    TextDocuments.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.documents = [];
                        if (message.documents && message.documents.length) {
                            object.documents = [];
                            for (let j = 0; j < message.documents.length; ++j)
                                object.documents[j] = $root.scala.meta.internal.semanticdb.TextDocument.toObject(message.documents[j], options);
                        }
                        return object;
                    };

                    /**
                     * Converts this TextDocuments to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.TextDocuments
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    TextDocuments.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for TextDocuments
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.TextDocuments
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    TextDocuments.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.TextDocuments";
                    };

                    return TextDocuments;
                })();

                semanticdb.TextDocument = (function() {

                    /**
                     * Properties of a TextDocument.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ITextDocument
                     * @property {scala.meta.internal.semanticdb.Schema|null} [schema] TextDocument schema
                     * @property {string|null} [uri] TextDocument uri
                     * @property {string|null} [text] TextDocument text
                     * @property {string|null} [md5] TextDocument md5
                     * @property {scala.meta.internal.semanticdb.Language|null} [language] TextDocument language
                     * @property {Array.<scala.meta.internal.semanticdb.ISymbolInformation>|null} [symbols] TextDocument symbols
                     * @property {Array.<scala.meta.internal.semanticdb.ISymbolOccurrence>|null} [occurrences] TextDocument occurrences
                     * @property {Array.<scala.meta.internal.semanticdb.IDiagnostic>|null} [diagnostics] TextDocument diagnostics
                     * @property {Array.<scala.meta.internal.semanticdb.ISynthetic>|null} [synthetics] TextDocument synthetics
                     * @property {string|null} [buildTarget] TextDocument buildTarget
                     */

                    /**
                     * Constructs a new TextDocument.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a TextDocument.
                     * @implements ITextDocument
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ITextDocument=} [properties] Properties to set
                     */
                    function TextDocument(properties) {
                        this.symbols = [];
                        this.occurrences = [];
                        this.diagnostics = [];
                        this.synthetics = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * TextDocument schema.
                     * @member {scala.meta.internal.semanticdb.Schema} schema
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @instance
                     */
                    TextDocument.prototype.schema = 0;

                    /**
                     * TextDocument uri.
                     * @member {string} uri
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @instance
                     */
                    TextDocument.prototype.uri = "";

                    /**
                     * TextDocument text.
                     * @member {string} text
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @instance
                     */
                    TextDocument.prototype.text = "";

                    /**
                     * TextDocument md5.
                     * @member {string} md5
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @instance
                     */
                    TextDocument.prototype.md5 = "";

                    /**
                     * TextDocument language.
                     * @member {scala.meta.internal.semanticdb.Language} language
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @instance
                     */
                    TextDocument.prototype.language = 0;

                    /**
                     * TextDocument symbols.
                     * @member {Array.<scala.meta.internal.semanticdb.ISymbolInformation>} symbols
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @instance
                     */
                    TextDocument.prototype.symbols = $util.emptyArray;

                    /**
                     * TextDocument occurrences.
                     * @member {Array.<scala.meta.internal.semanticdb.ISymbolOccurrence>} occurrences
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @instance
                     */
                    TextDocument.prototype.occurrences = $util.emptyArray;

                    /**
                     * TextDocument diagnostics.
                     * @member {Array.<scala.meta.internal.semanticdb.IDiagnostic>} diagnostics
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @instance
                     */
                    TextDocument.prototype.diagnostics = $util.emptyArray;

                    /**
                     * TextDocument synthetics.
                     * @member {Array.<scala.meta.internal.semanticdb.ISynthetic>} synthetics
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @instance
                     */
                    TextDocument.prototype.synthetics = $util.emptyArray;

                    /**
                     * TextDocument buildTarget.
                     * @member {string} buildTarget
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @instance
                     */
                    TextDocument.prototype.buildTarget = "";

                    /**
                     * Creates a new TextDocument instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITextDocument=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.TextDocument} TextDocument instance
                     */
                    TextDocument.create = function create(properties) {
                        return new TextDocument(properties);
                    };

                    /**
                     * Encodes the specified TextDocument message. Does not implicitly {@link scala.meta.internal.semanticdb.TextDocument.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITextDocument} message TextDocument message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    TextDocument.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.schema != null && Object.hasOwnProperty.call(message, "schema"))
                            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.schema);
                        if (message.uri != null && Object.hasOwnProperty.call(message, "uri"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.uri);
                        if (message.text != null && Object.hasOwnProperty.call(message, "text"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.text);
                        if (message.symbols != null && message.symbols.length)
                            for (let i = 0; i < message.symbols.length; ++i)
                                $root.scala.meta.internal.semanticdb.SymbolInformation.encode(message.symbols[i], writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
                        if (message.occurrences != null && message.occurrences.length)
                            for (let i = 0; i < message.occurrences.length; ++i)
                                $root.scala.meta.internal.semanticdb.SymbolOccurrence.encode(message.occurrences[i], writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
                        if (message.diagnostics != null && message.diagnostics.length)
                            for (let i = 0; i < message.diagnostics.length; ++i)
                                $root.scala.meta.internal.semanticdb.Diagnostic.encode(message.diagnostics[i], writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
                        if (message.language != null && Object.hasOwnProperty.call(message, "language"))
                            writer.uint32(/* id 10, wireType 0 =*/80).int32(message.language);
                        if (message.md5 != null && Object.hasOwnProperty.call(message, "md5"))
                            writer.uint32(/* id 11, wireType 2 =*/90).string(message.md5);
                        if (message.synthetics != null && message.synthetics.length)
                            for (let i = 0; i < message.synthetics.length; ++i)
                                $root.scala.meta.internal.semanticdb.Synthetic.encode(message.synthetics[i], writer.uint32(/* id 12, wireType 2 =*/98).fork()).ldelim();
                        if (message.buildTarget != null && Object.hasOwnProperty.call(message, "buildTarget"))
                            writer.uint32(/* id 13, wireType 2 =*/106).string(message.buildTarget);
                        return writer;
                    };

                    /**
                     * Encodes the specified TextDocument message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.TextDocument.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITextDocument} message TextDocument message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    TextDocument.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a TextDocument message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.TextDocument} TextDocument
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    TextDocument.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.TextDocument();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.schema = reader.int32();
                                    break;
                                }
                            case 2: {
                                    message.uri = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.text = reader.string();
                                    break;
                                }
                            case 11: {
                                    message.md5 = reader.string();
                                    break;
                                }
                            case 10: {
                                    message.language = reader.int32();
                                    break;
                                }
                            case 5: {
                                    if (!(message.symbols && message.symbols.length))
                                        message.symbols = [];
                                    message.symbols.push($root.scala.meta.internal.semanticdb.SymbolInformation.decode(reader, reader.uint32()));
                                    break;
                                }
                            case 6: {
                                    if (!(message.occurrences && message.occurrences.length))
                                        message.occurrences = [];
                                    message.occurrences.push($root.scala.meta.internal.semanticdb.SymbolOccurrence.decode(reader, reader.uint32()));
                                    break;
                                }
                            case 7: {
                                    if (!(message.diagnostics && message.diagnostics.length))
                                        message.diagnostics = [];
                                    message.diagnostics.push($root.scala.meta.internal.semanticdb.Diagnostic.decode(reader, reader.uint32()));
                                    break;
                                }
                            case 12: {
                                    if (!(message.synthetics && message.synthetics.length))
                                        message.synthetics = [];
                                    message.synthetics.push($root.scala.meta.internal.semanticdb.Synthetic.decode(reader, reader.uint32()));
                                    break;
                                }
                            case 13: {
                                    message.buildTarget = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a TextDocument message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.TextDocument} TextDocument
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    TextDocument.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a TextDocument message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    TextDocument.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.schema != null && message.hasOwnProperty("schema"))
                            switch (message.schema) {
                            default:
                                return "schema: enum value expected";
                            case 0:
                            case 3:
                            case 4:
                                break;
                            }
                        if (message.uri != null && message.hasOwnProperty("uri"))
                            if (!$util.isString(message.uri))
                                return "uri: string expected";
                        if (message.text != null && message.hasOwnProperty("text"))
                            if (!$util.isString(message.text))
                                return "text: string expected";
                        if (message.md5 != null && message.hasOwnProperty("md5"))
                            if (!$util.isString(message.md5))
                                return "md5: string expected";
                        if (message.language != null && message.hasOwnProperty("language"))
                            switch (message.language) {
                            default:
                                return "language: enum value expected";
                            case 0:
                            case 1:
                            case 2:
                            case 3:
                                break;
                            }
                        if (message.symbols != null && message.hasOwnProperty("symbols")) {
                            if (!Array.isArray(message.symbols))
                                return "symbols: array expected";
                            for (let i = 0; i < message.symbols.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.SymbolInformation.verify(message.symbols[i]);
                                if (error)
                                    return "symbols." + error;
                            }
                        }
                        if (message.occurrences != null && message.hasOwnProperty("occurrences")) {
                            if (!Array.isArray(message.occurrences))
                                return "occurrences: array expected";
                            for (let i = 0; i < message.occurrences.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.SymbolOccurrence.verify(message.occurrences[i]);
                                if (error)
                                    return "occurrences." + error;
                            }
                        }
                        if (message.diagnostics != null && message.hasOwnProperty("diagnostics")) {
                            if (!Array.isArray(message.diagnostics))
                                return "diagnostics: array expected";
                            for (let i = 0; i < message.diagnostics.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.Diagnostic.verify(message.diagnostics[i]);
                                if (error)
                                    return "diagnostics." + error;
                            }
                        }
                        if (message.synthetics != null && message.hasOwnProperty("synthetics")) {
                            if (!Array.isArray(message.synthetics))
                                return "synthetics: array expected";
                            for (let i = 0; i < message.synthetics.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.Synthetic.verify(message.synthetics[i]);
                                if (error)
                                    return "synthetics." + error;
                            }
                        }
                        if (message.buildTarget != null && message.hasOwnProperty("buildTarget"))
                            if (!$util.isString(message.buildTarget))
                                return "buildTarget: string expected";
                        return null;
                    };

                    /**
                     * Creates a TextDocument message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.TextDocument} TextDocument
                     */
                    TextDocument.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.TextDocument)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.TextDocument();
                        switch (object.schema) {
                        default:
                            if (typeof object.schema === "number") {
                                message.schema = object.schema;
                                break;
                            }
                            break;
                        case "LEGACY":
                        case 0:
                            message.schema = 0;
                            break;
                        case "SEMANTICDB3":
                        case 3:
                            message.schema = 3;
                            break;
                        case "SEMANTICDB4":
                        case 4:
                            message.schema = 4;
                            break;
                        }
                        if (object.uri != null)
                            message.uri = String(object.uri);
                        if (object.text != null)
                            message.text = String(object.text);
                        if (object.md5 != null)
                            message.md5 = String(object.md5);
                        switch (object.language) {
                        default:
                            if (typeof object.language === "number") {
                                message.language = object.language;
                                break;
                            }
                            break;
                        case "UNKNOWN_LANGUAGE":
                        case 0:
                            message.language = 0;
                            break;
                        case "SCALA":
                        case 1:
                            message.language = 1;
                            break;
                        case "JAVA":
                        case 2:
                            message.language = 2;
                            break;
                        case "PROTOBUF":
                        case 3:
                            message.language = 3;
                            break;
                        }
                        if (object.symbols) {
                            if (!Array.isArray(object.symbols))
                                throw TypeError(".scala.meta.internal.semanticdb.TextDocument.symbols: array expected");
                            message.symbols = [];
                            for (let i = 0; i < object.symbols.length; ++i) {
                                if (typeof object.symbols[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.TextDocument.symbols: object expected");
                                message.symbols[i] = $root.scala.meta.internal.semanticdb.SymbolInformation.fromObject(object.symbols[i]);
                            }
                        }
                        if (object.occurrences) {
                            if (!Array.isArray(object.occurrences))
                                throw TypeError(".scala.meta.internal.semanticdb.TextDocument.occurrences: array expected");
                            message.occurrences = [];
                            for (let i = 0; i < object.occurrences.length; ++i) {
                                if (typeof object.occurrences[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.TextDocument.occurrences: object expected");
                                message.occurrences[i] = $root.scala.meta.internal.semanticdb.SymbolOccurrence.fromObject(object.occurrences[i]);
                            }
                        }
                        if (object.diagnostics) {
                            if (!Array.isArray(object.diagnostics))
                                throw TypeError(".scala.meta.internal.semanticdb.TextDocument.diagnostics: array expected");
                            message.diagnostics = [];
                            for (let i = 0; i < object.diagnostics.length; ++i) {
                                if (typeof object.diagnostics[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.TextDocument.diagnostics: object expected");
                                message.diagnostics[i] = $root.scala.meta.internal.semanticdb.Diagnostic.fromObject(object.diagnostics[i]);
                            }
                        }
                        if (object.synthetics) {
                            if (!Array.isArray(object.synthetics))
                                throw TypeError(".scala.meta.internal.semanticdb.TextDocument.synthetics: array expected");
                            message.synthetics = [];
                            for (let i = 0; i < object.synthetics.length; ++i) {
                                if (typeof object.synthetics[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.TextDocument.synthetics: object expected");
                                message.synthetics[i] = $root.scala.meta.internal.semanticdb.Synthetic.fromObject(object.synthetics[i]);
                            }
                        }
                        if (object.buildTarget != null)
                            message.buildTarget = String(object.buildTarget);
                        return message;
                    };

                    /**
                     * Creates a plain object from a TextDocument message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @static
                     * @param {scala.meta.internal.semanticdb.TextDocument} message TextDocument
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    TextDocument.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults) {
                            object.symbols = [];
                            object.occurrences = [];
                            object.diagnostics = [];
                            object.synthetics = [];
                        }
                        if (options.defaults) {
                            object.schema = options.enums === String ? "LEGACY" : 0;
                            object.uri = "";
                            object.text = "";
                            object.language = options.enums === String ? "UNKNOWN_LANGUAGE" : 0;
                            object.md5 = "";
                            object.buildTarget = "";
                        }
                        if (message.schema != null && message.hasOwnProperty("schema"))
                            object.schema = options.enums === String ? $root.scala.meta.internal.semanticdb.Schema[message.schema] === undefined ? message.schema : $root.scala.meta.internal.semanticdb.Schema[message.schema] : message.schema;
                        if (message.uri != null && message.hasOwnProperty("uri"))
                            object.uri = message.uri;
                        if (message.text != null && message.hasOwnProperty("text"))
                            object.text = message.text;
                        if (message.symbols && message.symbols.length) {
                            object.symbols = [];
                            for (let j = 0; j < message.symbols.length; ++j)
                                object.symbols[j] = $root.scala.meta.internal.semanticdb.SymbolInformation.toObject(message.symbols[j], options);
                        }
                        if (message.occurrences && message.occurrences.length) {
                            object.occurrences = [];
                            for (let j = 0; j < message.occurrences.length; ++j)
                                object.occurrences[j] = $root.scala.meta.internal.semanticdb.SymbolOccurrence.toObject(message.occurrences[j], options);
                        }
                        if (message.diagnostics && message.diagnostics.length) {
                            object.diagnostics = [];
                            for (let j = 0; j < message.diagnostics.length; ++j)
                                object.diagnostics[j] = $root.scala.meta.internal.semanticdb.Diagnostic.toObject(message.diagnostics[j], options);
                        }
                        if (message.language != null && message.hasOwnProperty("language"))
                            object.language = options.enums === String ? $root.scala.meta.internal.semanticdb.Language[message.language] === undefined ? message.language : $root.scala.meta.internal.semanticdb.Language[message.language] : message.language;
                        if (message.md5 != null && message.hasOwnProperty("md5"))
                            object.md5 = message.md5;
                        if (message.synthetics && message.synthetics.length) {
                            object.synthetics = [];
                            for (let j = 0; j < message.synthetics.length; ++j)
                                object.synthetics[j] = $root.scala.meta.internal.semanticdb.Synthetic.toObject(message.synthetics[j], options);
                        }
                        if (message.buildTarget != null && message.hasOwnProperty("buildTarget"))
                            object.buildTarget = message.buildTarget;
                        return object;
                    };

                    /**
                     * Converts this TextDocument to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    TextDocument.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for TextDocument
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.TextDocument
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    TextDocument.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.TextDocument";
                    };

                    return TextDocument;
                })();

                /**
                 * Language enum.
                 * @name scala.meta.internal.semanticdb.Language
                 * @enum {number}
                 * @property {number} UNKNOWN_LANGUAGE=0 UNKNOWN_LANGUAGE value
                 * @property {number} SCALA=1 SCALA value
                 * @property {number} JAVA=2 JAVA value
                 * @property {number} PROTOBUF=3 PROTOBUF value
                 */
                semanticdb.Language = (function() {
                    const valuesById = {}, values = Object.create(valuesById);
                    values[valuesById[0] = "UNKNOWN_LANGUAGE"] = 0;
                    values[valuesById[1] = "SCALA"] = 1;
                    values[valuesById[2] = "JAVA"] = 2;
                    values[valuesById[3] = "PROTOBUF"] = 3;
                    return values;
                })();

                semanticdb.Range = (function() {

                    /**
                     * Properties of a Range.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IRange
                     * @property {number|null} [startLine] Range startLine
                     * @property {number|null} [startCharacter] Range startCharacter
                     * @property {number|null} [endLine] Range endLine
                     * @property {number|null} [endCharacter] Range endCharacter
                     */

                    /**
                     * Constructs a new Range.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a Range.
                     * @implements IRange
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IRange=} [properties] Properties to set
                     */
                    function Range(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Range startLine.
                     * @member {number} startLine
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @instance
                     */
                    Range.prototype.startLine = 0;

                    /**
                     * Range startCharacter.
                     * @member {number} startCharacter
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @instance
                     */
                    Range.prototype.startCharacter = 0;

                    /**
                     * Range endLine.
                     * @member {number} endLine
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @instance
                     */
                    Range.prototype.endLine = 0;

                    /**
                     * Range endCharacter.
                     * @member {number} endCharacter
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @instance
                     */
                    Range.prototype.endCharacter = 0;

                    /**
                     * Creates a new Range instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @static
                     * @param {scala.meta.internal.semanticdb.IRange=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.Range} Range instance
                     */
                    Range.create = function create(properties) {
                        return new Range(properties);
                    };

                    /**
                     * Encodes the specified Range message. Does not implicitly {@link scala.meta.internal.semanticdb.Range.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @static
                     * @param {scala.meta.internal.semanticdb.IRange} message Range message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Range.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.startLine != null && Object.hasOwnProperty.call(message, "startLine"))
                            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.startLine);
                        if (message.startCharacter != null && Object.hasOwnProperty.call(message, "startCharacter"))
                            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.startCharacter);
                        if (message.endLine != null && Object.hasOwnProperty.call(message, "endLine"))
                            writer.uint32(/* id 3, wireType 0 =*/24).int32(message.endLine);
                        if (message.endCharacter != null && Object.hasOwnProperty.call(message, "endCharacter"))
                            writer.uint32(/* id 4, wireType 0 =*/32).int32(message.endCharacter);
                        return writer;
                    };

                    /**
                     * Encodes the specified Range message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Range.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @static
                     * @param {scala.meta.internal.semanticdb.IRange} message Range message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Range.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Range message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.Range} Range
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Range.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Range();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.startLine = reader.int32();
                                    break;
                                }
                            case 2: {
                                    message.startCharacter = reader.int32();
                                    break;
                                }
                            case 3: {
                                    message.endLine = reader.int32();
                                    break;
                                }
                            case 4: {
                                    message.endCharacter = reader.int32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Range message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.Range} Range
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Range.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Range message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Range.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.startLine != null && message.hasOwnProperty("startLine"))
                            if (!$util.isInteger(message.startLine))
                                return "startLine: integer expected";
                        if (message.startCharacter != null && message.hasOwnProperty("startCharacter"))
                            if (!$util.isInteger(message.startCharacter))
                                return "startCharacter: integer expected";
                        if (message.endLine != null && message.hasOwnProperty("endLine"))
                            if (!$util.isInteger(message.endLine))
                                return "endLine: integer expected";
                        if (message.endCharacter != null && message.hasOwnProperty("endCharacter"))
                            if (!$util.isInteger(message.endCharacter))
                                return "endCharacter: integer expected";
                        return null;
                    };

                    /**
                     * Creates a Range message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.Range} Range
                     */
                    Range.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.Range)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.Range();
                        if (object.startLine != null)
                            message.startLine = object.startLine | 0;
                        if (object.startCharacter != null)
                            message.startCharacter = object.startCharacter | 0;
                        if (object.endLine != null)
                            message.endLine = object.endLine | 0;
                        if (object.endCharacter != null)
                            message.endCharacter = object.endCharacter | 0;
                        return message;
                    };

                    /**
                     * Creates a plain object from a Range message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @static
                     * @param {scala.meta.internal.semanticdb.Range} message Range
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Range.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.startLine = 0;
                            object.startCharacter = 0;
                            object.endLine = 0;
                            object.endCharacter = 0;
                        }
                        if (message.startLine != null && message.hasOwnProperty("startLine"))
                            object.startLine = message.startLine;
                        if (message.startCharacter != null && message.hasOwnProperty("startCharacter"))
                            object.startCharacter = message.startCharacter;
                        if (message.endLine != null && message.hasOwnProperty("endLine"))
                            object.endLine = message.endLine;
                        if (message.endCharacter != null && message.hasOwnProperty("endCharacter"))
                            object.endCharacter = message.endCharacter;
                        return object;
                    };

                    /**
                     * Converts this Range to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Range.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Range
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.Range
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Range.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.Range";
                    };

                    return Range;
                })();

                semanticdb.Location = (function() {

                    /**
                     * Properties of a Location.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ILocation
                     * @property {string|null} [uri] Location uri
                     * @property {scala.meta.internal.semanticdb.IRange|null} [range] Location range
                     */

                    /**
                     * Constructs a new Location.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a Location.
                     * @implements ILocation
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ILocation=} [properties] Properties to set
                     */
                    function Location(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Location uri.
                     * @member {string} uri
                     * @memberof scala.meta.internal.semanticdb.Location
                     * @instance
                     */
                    Location.prototype.uri = "";

                    /**
                     * Location range.
                     * @member {scala.meta.internal.semanticdb.IRange|null|undefined} range
                     * @memberof scala.meta.internal.semanticdb.Location
                     * @instance
                     */
                    Location.prototype.range = null;

                    /**
                     * Creates a new Location instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.Location
                     * @static
                     * @param {scala.meta.internal.semanticdb.ILocation=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.Location} Location instance
                     */
                    Location.create = function create(properties) {
                        return new Location(properties);
                    };

                    /**
                     * Encodes the specified Location message. Does not implicitly {@link scala.meta.internal.semanticdb.Location.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.Location
                     * @static
                     * @param {scala.meta.internal.semanticdb.ILocation} message Location message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Location.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.uri != null && Object.hasOwnProperty.call(message, "uri"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.uri);
                        if (message.range != null && Object.hasOwnProperty.call(message, "range"))
                            $root.scala.meta.internal.semanticdb.Range.encode(message.range, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified Location message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Location.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Location
                     * @static
                     * @param {scala.meta.internal.semanticdb.ILocation} message Location message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Location.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Location message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.Location
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.Location} Location
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Location.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Location();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.uri = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.range = $root.scala.meta.internal.semanticdb.Range.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Location message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Location
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.Location} Location
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Location.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Location message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.Location
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Location.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.uri != null && message.hasOwnProperty("uri"))
                            if (!$util.isString(message.uri))
                                return "uri: string expected";
                        if (message.range != null && message.hasOwnProperty("range")) {
                            let error = $root.scala.meta.internal.semanticdb.Range.verify(message.range);
                            if (error)
                                return "range." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a Location message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.Location
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.Location} Location
                     */
                    Location.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.Location)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.Location();
                        if (object.uri != null)
                            message.uri = String(object.uri);
                        if (object.range != null) {
                            if (typeof object.range !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Location.range: object expected");
                            message.range = $root.scala.meta.internal.semanticdb.Range.fromObject(object.range);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a Location message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.Location
                     * @static
                     * @param {scala.meta.internal.semanticdb.Location} message Location
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Location.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.uri = "";
                            object.range = null;
                        }
                        if (message.uri != null && message.hasOwnProperty("uri"))
                            object.uri = message.uri;
                        if (message.range != null && message.hasOwnProperty("range"))
                            object.range = $root.scala.meta.internal.semanticdb.Range.toObject(message.range, options);
                        return object;
                    };

                    /**
                     * Converts this Location to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.Location
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Location.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Location
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.Location
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Location.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.Location";
                    };

                    return Location;
                })();

                semanticdb.Scope = (function() {

                    /**
                     * Properties of a Scope.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IScope
                     * @property {Array.<string>|null} [symlinks] Scope symlinks
                     * @property {Array.<scala.meta.internal.semanticdb.ISymbolInformation>|null} [hardlinks] Scope hardlinks
                     */

                    /**
                     * Constructs a new Scope.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a Scope.
                     * @implements IScope
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IScope=} [properties] Properties to set
                     */
                    function Scope(properties) {
                        this.symlinks = [];
                        this.hardlinks = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Scope symlinks.
                     * @member {Array.<string>} symlinks
                     * @memberof scala.meta.internal.semanticdb.Scope
                     * @instance
                     */
                    Scope.prototype.symlinks = $util.emptyArray;

                    /**
                     * Scope hardlinks.
                     * @member {Array.<scala.meta.internal.semanticdb.ISymbolInformation>} hardlinks
                     * @memberof scala.meta.internal.semanticdb.Scope
                     * @instance
                     */
                    Scope.prototype.hardlinks = $util.emptyArray;

                    /**
                     * Creates a new Scope instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.Scope
                     * @static
                     * @param {scala.meta.internal.semanticdb.IScope=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.Scope} Scope instance
                     */
                    Scope.create = function create(properties) {
                        return new Scope(properties);
                    };

                    /**
                     * Encodes the specified Scope message. Does not implicitly {@link scala.meta.internal.semanticdb.Scope.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.Scope
                     * @static
                     * @param {scala.meta.internal.semanticdb.IScope} message Scope message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Scope.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.symlinks != null && message.symlinks.length)
                            for (let i = 0; i < message.symlinks.length; ++i)
                                writer.uint32(/* id 1, wireType 2 =*/10).string(message.symlinks[i]);
                        if (message.hardlinks != null && message.hardlinks.length)
                            for (let i = 0; i < message.hardlinks.length; ++i)
                                $root.scala.meta.internal.semanticdb.SymbolInformation.encode(message.hardlinks[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified Scope message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Scope.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Scope
                     * @static
                     * @param {scala.meta.internal.semanticdb.IScope} message Scope message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Scope.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Scope message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.Scope
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.Scope} Scope
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Scope.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Scope();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    if (!(message.symlinks && message.symlinks.length))
                                        message.symlinks = [];
                                    message.symlinks.push(reader.string());
                                    break;
                                }
                            case 2: {
                                    if (!(message.hardlinks && message.hardlinks.length))
                                        message.hardlinks = [];
                                    message.hardlinks.push($root.scala.meta.internal.semanticdb.SymbolInformation.decode(reader, reader.uint32()));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Scope message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Scope
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.Scope} Scope
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Scope.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Scope message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.Scope
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Scope.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.symlinks != null && message.hasOwnProperty("symlinks")) {
                            if (!Array.isArray(message.symlinks))
                                return "symlinks: array expected";
                            for (let i = 0; i < message.symlinks.length; ++i)
                                if (!$util.isString(message.symlinks[i]))
                                    return "symlinks: string[] expected";
                        }
                        if (message.hardlinks != null && message.hasOwnProperty("hardlinks")) {
                            if (!Array.isArray(message.hardlinks))
                                return "hardlinks: array expected";
                            for (let i = 0; i < message.hardlinks.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.SymbolInformation.verify(message.hardlinks[i]);
                                if (error)
                                    return "hardlinks." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates a Scope message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.Scope
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.Scope} Scope
                     */
                    Scope.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.Scope)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.Scope();
                        if (object.symlinks) {
                            if (!Array.isArray(object.symlinks))
                                throw TypeError(".scala.meta.internal.semanticdb.Scope.symlinks: array expected");
                            message.symlinks = [];
                            for (let i = 0; i < object.symlinks.length; ++i)
                                message.symlinks[i] = String(object.symlinks[i]);
                        }
                        if (object.hardlinks) {
                            if (!Array.isArray(object.hardlinks))
                                throw TypeError(".scala.meta.internal.semanticdb.Scope.hardlinks: array expected");
                            message.hardlinks = [];
                            for (let i = 0; i < object.hardlinks.length; ++i) {
                                if (typeof object.hardlinks[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.Scope.hardlinks: object expected");
                                message.hardlinks[i] = $root.scala.meta.internal.semanticdb.SymbolInformation.fromObject(object.hardlinks[i]);
                            }
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a Scope message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.Scope
                     * @static
                     * @param {scala.meta.internal.semanticdb.Scope} message Scope
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Scope.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults) {
                            object.symlinks = [];
                            object.hardlinks = [];
                        }
                        if (message.symlinks && message.symlinks.length) {
                            object.symlinks = [];
                            for (let j = 0; j < message.symlinks.length; ++j)
                                object.symlinks[j] = message.symlinks[j];
                        }
                        if (message.hardlinks && message.hardlinks.length) {
                            object.hardlinks = [];
                            for (let j = 0; j < message.hardlinks.length; ++j)
                                object.hardlinks[j] = $root.scala.meta.internal.semanticdb.SymbolInformation.toObject(message.hardlinks[j], options);
                        }
                        return object;
                    };

                    /**
                     * Converts this Scope to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.Scope
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Scope.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Scope
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.Scope
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Scope.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.Scope";
                    };

                    return Scope;
                })();

                semanticdb.Type = (function() {

                    /**
                     * Properties of a Type.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IType
                     * @property {scala.meta.internal.semanticdb.ITypeRef|null} [typeRef] Type typeRef
                     * @property {scala.meta.internal.semanticdb.ISingleType|null} [singleType] Type singleType
                     * @property {scala.meta.internal.semanticdb.IThisType|null} [thisType] Type thisType
                     * @property {scala.meta.internal.semanticdb.ISuperType|null} [superType] Type superType
                     * @property {scala.meta.internal.semanticdb.IConstantType|null} [constantType] Type constantType
                     * @property {scala.meta.internal.semanticdb.IIntersectionType|null} [intersectionType] Type intersectionType
                     * @property {scala.meta.internal.semanticdb.IUnionType|null} [unionType] Type unionType
                     * @property {scala.meta.internal.semanticdb.IWithType|null} [withType] Type withType
                     * @property {scala.meta.internal.semanticdb.IStructuralType|null} [structuralType] Type structuralType
                     * @property {scala.meta.internal.semanticdb.IAnnotatedType|null} [annotatedType] Type annotatedType
                     * @property {scala.meta.internal.semanticdb.IExistentialType|null} [existentialType] Type existentialType
                     * @property {scala.meta.internal.semanticdb.IUniversalType|null} [universalType] Type universalType
                     * @property {scala.meta.internal.semanticdb.IByNameType|null} [byNameType] Type byNameType
                     * @property {scala.meta.internal.semanticdb.IRepeatedType|null} [repeatedType] Type repeatedType
                     * @property {scala.meta.internal.semanticdb.IMatchType|null} [matchType] Type matchType
                     * @property {scala.meta.internal.semanticdb.ILambdaType|null} [lambdaType] Type lambdaType
                     */

                    /**
                     * Constructs a new Type.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a Type.
                     * @implements IType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IType=} [properties] Properties to set
                     */
                    function Type(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Type typeRef.
                     * @member {scala.meta.internal.semanticdb.ITypeRef|null|undefined} typeRef
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.typeRef = null;

                    /**
                     * Type singleType.
                     * @member {scala.meta.internal.semanticdb.ISingleType|null|undefined} singleType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.singleType = null;

                    /**
                     * Type thisType.
                     * @member {scala.meta.internal.semanticdb.IThisType|null|undefined} thisType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.thisType = null;

                    /**
                     * Type superType.
                     * @member {scala.meta.internal.semanticdb.ISuperType|null|undefined} superType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.superType = null;

                    /**
                     * Type constantType.
                     * @member {scala.meta.internal.semanticdb.IConstantType|null|undefined} constantType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.constantType = null;

                    /**
                     * Type intersectionType.
                     * @member {scala.meta.internal.semanticdb.IIntersectionType|null|undefined} intersectionType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.intersectionType = null;

                    /**
                     * Type unionType.
                     * @member {scala.meta.internal.semanticdb.IUnionType|null|undefined} unionType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.unionType = null;

                    /**
                     * Type withType.
                     * @member {scala.meta.internal.semanticdb.IWithType|null|undefined} withType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.withType = null;

                    /**
                     * Type structuralType.
                     * @member {scala.meta.internal.semanticdb.IStructuralType|null|undefined} structuralType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.structuralType = null;

                    /**
                     * Type annotatedType.
                     * @member {scala.meta.internal.semanticdb.IAnnotatedType|null|undefined} annotatedType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.annotatedType = null;

                    /**
                     * Type existentialType.
                     * @member {scala.meta.internal.semanticdb.IExistentialType|null|undefined} existentialType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.existentialType = null;

                    /**
                     * Type universalType.
                     * @member {scala.meta.internal.semanticdb.IUniversalType|null|undefined} universalType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.universalType = null;

                    /**
                     * Type byNameType.
                     * @member {scala.meta.internal.semanticdb.IByNameType|null|undefined} byNameType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.byNameType = null;

                    /**
                     * Type repeatedType.
                     * @member {scala.meta.internal.semanticdb.IRepeatedType|null|undefined} repeatedType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.repeatedType = null;

                    /**
                     * Type matchType.
                     * @member {scala.meta.internal.semanticdb.IMatchType|null|undefined} matchType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.matchType = null;

                    /**
                     * Type lambdaType.
                     * @member {scala.meta.internal.semanticdb.ILambdaType|null|undefined} lambdaType
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Type.prototype.lambdaType = null;

                    // OneOf field names bound to virtual getters and setters
                    let $oneOfFields;

                    /**
                     * Type sealedValue.
                     * @member {"typeRef"|"singleType"|"thisType"|"superType"|"constantType"|"intersectionType"|"unionType"|"withType"|"structuralType"|"annotatedType"|"existentialType"|"universalType"|"byNameType"|"repeatedType"|"matchType"|"lambdaType"|undefined} sealedValue
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     */
                    Object.defineProperty(Type.prototype, "sealedValue", {
                        get: $util.oneOfGetter($oneOfFields = ["typeRef", "singleType", "thisType", "superType", "constantType", "intersectionType", "unionType", "withType", "structuralType", "annotatedType", "existentialType", "universalType", "byNameType", "repeatedType", "matchType", "lambdaType"]),
                        set: $util.oneOfSetter($oneOfFields)
                    });

                    /**
                     * Creates a new Type instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @static
                     * @param {scala.meta.internal.semanticdb.IType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.Type} Type instance
                     */
                    Type.create = function create(properties) {
                        return new Type(properties);
                    };

                    /**
                     * Encodes the specified Type message. Does not implicitly {@link scala.meta.internal.semanticdb.Type.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @static
                     * @param {scala.meta.internal.semanticdb.IType} message Type message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Type.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.typeRef != null && Object.hasOwnProperty.call(message, "typeRef"))
                            $root.scala.meta.internal.semanticdb.TypeRef.encode(message.typeRef, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.structuralType != null && Object.hasOwnProperty.call(message, "structuralType"))
                            $root.scala.meta.internal.semanticdb.StructuralType.encode(message.structuralType, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
                        if (message.annotatedType != null && Object.hasOwnProperty.call(message, "annotatedType"))
                            $root.scala.meta.internal.semanticdb.AnnotatedType.encode(message.annotatedType, writer.uint32(/* id 8, wireType 2 =*/66).fork()).ldelim();
                        if (message.existentialType != null && Object.hasOwnProperty.call(message, "existentialType"))
                            $root.scala.meta.internal.semanticdb.ExistentialType.encode(message.existentialType, writer.uint32(/* id 9, wireType 2 =*/74).fork()).ldelim();
                        if (message.universalType != null && Object.hasOwnProperty.call(message, "universalType"))
                            $root.scala.meta.internal.semanticdb.UniversalType.encode(message.universalType, writer.uint32(/* id 10, wireType 2 =*/82).fork()).ldelim();
                        if (message.byNameType != null && Object.hasOwnProperty.call(message, "byNameType"))
                            $root.scala.meta.internal.semanticdb.ByNameType.encode(message.byNameType, writer.uint32(/* id 13, wireType 2 =*/106).fork()).ldelim();
                        if (message.repeatedType != null && Object.hasOwnProperty.call(message, "repeatedType"))
                            $root.scala.meta.internal.semanticdb.RepeatedType.encode(message.repeatedType, writer.uint32(/* id 14, wireType 2 =*/114).fork()).ldelim();
                        if (message.intersectionType != null && Object.hasOwnProperty.call(message, "intersectionType"))
                            $root.scala.meta.internal.semanticdb.IntersectionType.encode(message.intersectionType, writer.uint32(/* id 17, wireType 2 =*/138).fork()).ldelim();
                        if (message.unionType != null && Object.hasOwnProperty.call(message, "unionType"))
                            $root.scala.meta.internal.semanticdb.UnionType.encode(message.unionType, writer.uint32(/* id 18, wireType 2 =*/146).fork()).ldelim();
                        if (message.withType != null && Object.hasOwnProperty.call(message, "withType"))
                            $root.scala.meta.internal.semanticdb.WithType.encode(message.withType, writer.uint32(/* id 19, wireType 2 =*/154).fork()).ldelim();
                        if (message.singleType != null && Object.hasOwnProperty.call(message, "singleType"))
                            $root.scala.meta.internal.semanticdb.SingleType.encode(message.singleType, writer.uint32(/* id 20, wireType 2 =*/162).fork()).ldelim();
                        if (message.thisType != null && Object.hasOwnProperty.call(message, "thisType"))
                            $root.scala.meta.internal.semanticdb.ThisType.encode(message.thisType, writer.uint32(/* id 21, wireType 2 =*/170).fork()).ldelim();
                        if (message.superType != null && Object.hasOwnProperty.call(message, "superType"))
                            $root.scala.meta.internal.semanticdb.SuperType.encode(message.superType, writer.uint32(/* id 22, wireType 2 =*/178).fork()).ldelim();
                        if (message.constantType != null && Object.hasOwnProperty.call(message, "constantType"))
                            $root.scala.meta.internal.semanticdb.ConstantType.encode(message.constantType, writer.uint32(/* id 23, wireType 2 =*/186).fork()).ldelim();
                        if (message.matchType != null && Object.hasOwnProperty.call(message, "matchType"))
                            $root.scala.meta.internal.semanticdb.MatchType.encode(message.matchType, writer.uint32(/* id 25, wireType 2 =*/202).fork()).ldelim();
                        if (message.lambdaType != null && Object.hasOwnProperty.call(message, "lambdaType"))
                            $root.scala.meta.internal.semanticdb.LambdaType.encode(message.lambdaType, writer.uint32(/* id 26, wireType 2 =*/210).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified Type message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Type.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @static
                     * @param {scala.meta.internal.semanticdb.IType} message Type message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Type.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Type message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.Type} Type
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Type.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Type();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 2: {
                                    message.typeRef = $root.scala.meta.internal.semanticdb.TypeRef.decode(reader, reader.uint32());
                                    break;
                                }
                            case 20: {
                                    message.singleType = $root.scala.meta.internal.semanticdb.SingleType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 21: {
                                    message.thisType = $root.scala.meta.internal.semanticdb.ThisType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 22: {
                                    message.superType = $root.scala.meta.internal.semanticdb.SuperType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 23: {
                                    message.constantType = $root.scala.meta.internal.semanticdb.ConstantType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 17: {
                                    message.intersectionType = $root.scala.meta.internal.semanticdb.IntersectionType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 18: {
                                    message.unionType = $root.scala.meta.internal.semanticdb.UnionType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 19: {
                                    message.withType = $root.scala.meta.internal.semanticdb.WithType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 7: {
                                    message.structuralType = $root.scala.meta.internal.semanticdb.StructuralType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 8: {
                                    message.annotatedType = $root.scala.meta.internal.semanticdb.AnnotatedType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 9: {
                                    message.existentialType = $root.scala.meta.internal.semanticdb.ExistentialType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 10: {
                                    message.universalType = $root.scala.meta.internal.semanticdb.UniversalType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 13: {
                                    message.byNameType = $root.scala.meta.internal.semanticdb.ByNameType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 14: {
                                    message.repeatedType = $root.scala.meta.internal.semanticdb.RepeatedType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 25: {
                                    message.matchType = $root.scala.meta.internal.semanticdb.MatchType.decode(reader, reader.uint32());
                                    break;
                                }
                            case 26: {
                                    message.lambdaType = $root.scala.meta.internal.semanticdb.LambdaType.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Type message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.Type} Type
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Type.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Type message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Type.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        let properties = {};
                        if (message.typeRef != null && message.hasOwnProperty("typeRef")) {
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.TypeRef.verify(message.typeRef);
                                if (error)
                                    return "typeRef." + error;
                            }
                        }
                        if (message.singleType != null && message.hasOwnProperty("singleType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.SingleType.verify(message.singleType);
                                if (error)
                                    return "singleType." + error;
                            }
                        }
                        if (message.thisType != null && message.hasOwnProperty("thisType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.ThisType.verify(message.thisType);
                                if (error)
                                    return "thisType." + error;
                            }
                        }
                        if (message.superType != null && message.hasOwnProperty("superType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.SuperType.verify(message.superType);
                                if (error)
                                    return "superType." + error;
                            }
                        }
                        if (message.constantType != null && message.hasOwnProperty("constantType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.ConstantType.verify(message.constantType);
                                if (error)
                                    return "constantType." + error;
                            }
                        }
                        if (message.intersectionType != null && message.hasOwnProperty("intersectionType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.IntersectionType.verify(message.intersectionType);
                                if (error)
                                    return "intersectionType." + error;
                            }
                        }
                        if (message.unionType != null && message.hasOwnProperty("unionType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.UnionType.verify(message.unionType);
                                if (error)
                                    return "unionType." + error;
                            }
                        }
                        if (message.withType != null && message.hasOwnProperty("withType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.WithType.verify(message.withType);
                                if (error)
                                    return "withType." + error;
                            }
                        }
                        if (message.structuralType != null && message.hasOwnProperty("structuralType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.StructuralType.verify(message.structuralType);
                                if (error)
                                    return "structuralType." + error;
                            }
                        }
                        if (message.annotatedType != null && message.hasOwnProperty("annotatedType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.AnnotatedType.verify(message.annotatedType);
                                if (error)
                                    return "annotatedType." + error;
                            }
                        }
                        if (message.existentialType != null && message.hasOwnProperty("existentialType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.ExistentialType.verify(message.existentialType);
                                if (error)
                                    return "existentialType." + error;
                            }
                        }
                        if (message.universalType != null && message.hasOwnProperty("universalType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.UniversalType.verify(message.universalType);
                                if (error)
                                    return "universalType." + error;
                            }
                        }
                        if (message.byNameType != null && message.hasOwnProperty("byNameType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.ByNameType.verify(message.byNameType);
                                if (error)
                                    return "byNameType." + error;
                            }
                        }
                        if (message.repeatedType != null && message.hasOwnProperty("repeatedType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.RepeatedType.verify(message.repeatedType);
                                if (error)
                                    return "repeatedType." + error;
                            }
                        }
                        if (message.matchType != null && message.hasOwnProperty("matchType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.MatchType.verify(message.matchType);
                                if (error)
                                    return "matchType." + error;
                            }
                        }
                        if (message.lambdaType != null && message.hasOwnProperty("lambdaType")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.LambdaType.verify(message.lambdaType);
                                if (error)
                                    return "lambdaType." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates a Type message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.Type} Type
                     */
                    Type.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.Type)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.Type();
                        if (object.typeRef != null) {
                            if (typeof object.typeRef !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.typeRef: object expected");
                            message.typeRef = $root.scala.meta.internal.semanticdb.TypeRef.fromObject(object.typeRef);
                        }
                        if (object.singleType != null) {
                            if (typeof object.singleType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.singleType: object expected");
                            message.singleType = $root.scala.meta.internal.semanticdb.SingleType.fromObject(object.singleType);
                        }
                        if (object.thisType != null) {
                            if (typeof object.thisType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.thisType: object expected");
                            message.thisType = $root.scala.meta.internal.semanticdb.ThisType.fromObject(object.thisType);
                        }
                        if (object.superType != null) {
                            if (typeof object.superType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.superType: object expected");
                            message.superType = $root.scala.meta.internal.semanticdb.SuperType.fromObject(object.superType);
                        }
                        if (object.constantType != null) {
                            if (typeof object.constantType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.constantType: object expected");
                            message.constantType = $root.scala.meta.internal.semanticdb.ConstantType.fromObject(object.constantType);
                        }
                        if (object.intersectionType != null) {
                            if (typeof object.intersectionType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.intersectionType: object expected");
                            message.intersectionType = $root.scala.meta.internal.semanticdb.IntersectionType.fromObject(object.intersectionType);
                        }
                        if (object.unionType != null) {
                            if (typeof object.unionType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.unionType: object expected");
                            message.unionType = $root.scala.meta.internal.semanticdb.UnionType.fromObject(object.unionType);
                        }
                        if (object.withType != null) {
                            if (typeof object.withType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.withType: object expected");
                            message.withType = $root.scala.meta.internal.semanticdb.WithType.fromObject(object.withType);
                        }
                        if (object.structuralType != null) {
                            if (typeof object.structuralType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.structuralType: object expected");
                            message.structuralType = $root.scala.meta.internal.semanticdb.StructuralType.fromObject(object.structuralType);
                        }
                        if (object.annotatedType != null) {
                            if (typeof object.annotatedType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.annotatedType: object expected");
                            message.annotatedType = $root.scala.meta.internal.semanticdb.AnnotatedType.fromObject(object.annotatedType);
                        }
                        if (object.existentialType != null) {
                            if (typeof object.existentialType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.existentialType: object expected");
                            message.existentialType = $root.scala.meta.internal.semanticdb.ExistentialType.fromObject(object.existentialType);
                        }
                        if (object.universalType != null) {
                            if (typeof object.universalType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.universalType: object expected");
                            message.universalType = $root.scala.meta.internal.semanticdb.UniversalType.fromObject(object.universalType);
                        }
                        if (object.byNameType != null) {
                            if (typeof object.byNameType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.byNameType: object expected");
                            message.byNameType = $root.scala.meta.internal.semanticdb.ByNameType.fromObject(object.byNameType);
                        }
                        if (object.repeatedType != null) {
                            if (typeof object.repeatedType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.repeatedType: object expected");
                            message.repeatedType = $root.scala.meta.internal.semanticdb.RepeatedType.fromObject(object.repeatedType);
                        }
                        if (object.matchType != null) {
                            if (typeof object.matchType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.matchType: object expected");
                            message.matchType = $root.scala.meta.internal.semanticdb.MatchType.fromObject(object.matchType);
                        }
                        if (object.lambdaType != null) {
                            if (typeof object.lambdaType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Type.lambdaType: object expected");
                            message.lambdaType = $root.scala.meta.internal.semanticdb.LambdaType.fromObject(object.lambdaType);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a Type message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @static
                     * @param {scala.meta.internal.semanticdb.Type} message Type
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Type.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (message.typeRef != null && message.hasOwnProperty("typeRef")) {
                            object.typeRef = $root.scala.meta.internal.semanticdb.TypeRef.toObject(message.typeRef, options);
                            if (options.oneofs)
                                object.sealedValue = "typeRef";
                        }
                        if (message.structuralType != null && message.hasOwnProperty("structuralType")) {
                            object.structuralType = $root.scala.meta.internal.semanticdb.StructuralType.toObject(message.structuralType, options);
                            if (options.oneofs)
                                object.sealedValue = "structuralType";
                        }
                        if (message.annotatedType != null && message.hasOwnProperty("annotatedType")) {
                            object.annotatedType = $root.scala.meta.internal.semanticdb.AnnotatedType.toObject(message.annotatedType, options);
                            if (options.oneofs)
                                object.sealedValue = "annotatedType";
                        }
                        if (message.existentialType != null && message.hasOwnProperty("existentialType")) {
                            object.existentialType = $root.scala.meta.internal.semanticdb.ExistentialType.toObject(message.existentialType, options);
                            if (options.oneofs)
                                object.sealedValue = "existentialType";
                        }
                        if (message.universalType != null && message.hasOwnProperty("universalType")) {
                            object.universalType = $root.scala.meta.internal.semanticdb.UniversalType.toObject(message.universalType, options);
                            if (options.oneofs)
                                object.sealedValue = "universalType";
                        }
                        if (message.byNameType != null && message.hasOwnProperty("byNameType")) {
                            object.byNameType = $root.scala.meta.internal.semanticdb.ByNameType.toObject(message.byNameType, options);
                            if (options.oneofs)
                                object.sealedValue = "byNameType";
                        }
                        if (message.repeatedType != null && message.hasOwnProperty("repeatedType")) {
                            object.repeatedType = $root.scala.meta.internal.semanticdb.RepeatedType.toObject(message.repeatedType, options);
                            if (options.oneofs)
                                object.sealedValue = "repeatedType";
                        }
                        if (message.intersectionType != null && message.hasOwnProperty("intersectionType")) {
                            object.intersectionType = $root.scala.meta.internal.semanticdb.IntersectionType.toObject(message.intersectionType, options);
                            if (options.oneofs)
                                object.sealedValue = "intersectionType";
                        }
                        if (message.unionType != null && message.hasOwnProperty("unionType")) {
                            object.unionType = $root.scala.meta.internal.semanticdb.UnionType.toObject(message.unionType, options);
                            if (options.oneofs)
                                object.sealedValue = "unionType";
                        }
                        if (message.withType != null && message.hasOwnProperty("withType")) {
                            object.withType = $root.scala.meta.internal.semanticdb.WithType.toObject(message.withType, options);
                            if (options.oneofs)
                                object.sealedValue = "withType";
                        }
                        if (message.singleType != null && message.hasOwnProperty("singleType")) {
                            object.singleType = $root.scala.meta.internal.semanticdb.SingleType.toObject(message.singleType, options);
                            if (options.oneofs)
                                object.sealedValue = "singleType";
                        }
                        if (message.thisType != null && message.hasOwnProperty("thisType")) {
                            object.thisType = $root.scala.meta.internal.semanticdb.ThisType.toObject(message.thisType, options);
                            if (options.oneofs)
                                object.sealedValue = "thisType";
                        }
                        if (message.superType != null && message.hasOwnProperty("superType")) {
                            object.superType = $root.scala.meta.internal.semanticdb.SuperType.toObject(message.superType, options);
                            if (options.oneofs)
                                object.sealedValue = "superType";
                        }
                        if (message.constantType != null && message.hasOwnProperty("constantType")) {
                            object.constantType = $root.scala.meta.internal.semanticdb.ConstantType.toObject(message.constantType, options);
                            if (options.oneofs)
                                object.sealedValue = "constantType";
                        }
                        if (message.matchType != null && message.hasOwnProperty("matchType")) {
                            object.matchType = $root.scala.meta.internal.semanticdb.MatchType.toObject(message.matchType, options);
                            if (options.oneofs)
                                object.sealedValue = "matchType";
                        }
                        if (message.lambdaType != null && message.hasOwnProperty("lambdaType")) {
                            object.lambdaType = $root.scala.meta.internal.semanticdb.LambdaType.toObject(message.lambdaType, options);
                            if (options.oneofs)
                                object.sealedValue = "lambdaType";
                        }
                        return object;
                    };

                    /**
                     * Converts this Type to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Type.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Type
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.Type
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Type.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.Type";
                    };

                    return Type;
                })();

                semanticdb.LambdaType = (function() {

                    /**
                     * Properties of a LambdaType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ILambdaType
                     * @property {scala.meta.internal.semanticdb.IScope|null} [parameters] LambdaType parameters
                     * @property {scala.meta.internal.semanticdb.IType|null} [returnType] LambdaType returnType
                     */

                    /**
                     * Constructs a new LambdaType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a LambdaType.
                     * @implements ILambdaType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ILambdaType=} [properties] Properties to set
                     */
                    function LambdaType(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * LambdaType parameters.
                     * @member {scala.meta.internal.semanticdb.IScope|null|undefined} parameters
                     * @memberof scala.meta.internal.semanticdb.LambdaType
                     * @instance
                     */
                    LambdaType.prototype.parameters = null;

                    /**
                     * LambdaType returnType.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} returnType
                     * @memberof scala.meta.internal.semanticdb.LambdaType
                     * @instance
                     */
                    LambdaType.prototype.returnType = null;

                    /**
                     * Creates a new LambdaType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.LambdaType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ILambdaType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.LambdaType} LambdaType instance
                     */
                    LambdaType.create = function create(properties) {
                        return new LambdaType(properties);
                    };

                    /**
                     * Encodes the specified LambdaType message. Does not implicitly {@link scala.meta.internal.semanticdb.LambdaType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.LambdaType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ILambdaType} message LambdaType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    LambdaType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.parameters != null && Object.hasOwnProperty.call(message, "parameters"))
                            $root.scala.meta.internal.semanticdb.Scope.encode(message.parameters, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.returnType != null && Object.hasOwnProperty.call(message, "returnType"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.returnType, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified LambdaType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.LambdaType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.LambdaType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ILambdaType} message LambdaType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    LambdaType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a LambdaType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.LambdaType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.LambdaType} LambdaType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    LambdaType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.LambdaType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.parameters = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.returnType = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a LambdaType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.LambdaType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.LambdaType} LambdaType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    LambdaType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a LambdaType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.LambdaType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    LambdaType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.parameters != null && message.hasOwnProperty("parameters")) {
                            let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.parameters);
                            if (error)
                                return "parameters." + error;
                        }
                        if (message.returnType != null && message.hasOwnProperty("returnType")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.returnType);
                            if (error)
                                return "returnType." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a LambdaType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.LambdaType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.LambdaType} LambdaType
                     */
                    LambdaType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.LambdaType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.LambdaType();
                        if (object.parameters != null) {
                            if (typeof object.parameters !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.LambdaType.parameters: object expected");
                            message.parameters = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.parameters);
                        }
                        if (object.returnType != null) {
                            if (typeof object.returnType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.LambdaType.returnType: object expected");
                            message.returnType = $root.scala.meta.internal.semanticdb.Type.fromObject(object.returnType);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a LambdaType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.LambdaType
                     * @static
                     * @param {scala.meta.internal.semanticdb.LambdaType} message LambdaType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    LambdaType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.parameters = null;
                            object.returnType = null;
                        }
                        if (message.parameters != null && message.hasOwnProperty("parameters"))
                            object.parameters = $root.scala.meta.internal.semanticdb.Scope.toObject(message.parameters, options);
                        if (message.returnType != null && message.hasOwnProperty("returnType"))
                            object.returnType = $root.scala.meta.internal.semanticdb.Type.toObject(message.returnType, options);
                        return object;
                    };

                    /**
                     * Converts this LambdaType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.LambdaType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    LambdaType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for LambdaType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.LambdaType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    LambdaType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.LambdaType";
                    };

                    return LambdaType;
                })();

                semanticdb.TypeRef = (function() {

                    /**
                     * Properties of a TypeRef.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ITypeRef
                     * @property {scala.meta.internal.semanticdb.IType|null} [prefix] TypeRef prefix
                     * @property {string|null} [symbol] TypeRef symbol
                     * @property {Array.<scala.meta.internal.semanticdb.IType>|null} [typeArguments] TypeRef typeArguments
                     */

                    /**
                     * Constructs a new TypeRef.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a TypeRef.
                     * @implements ITypeRef
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ITypeRef=} [properties] Properties to set
                     */
                    function TypeRef(properties) {
                        this.typeArguments = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * TypeRef prefix.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} prefix
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @instance
                     */
                    TypeRef.prototype.prefix = null;

                    /**
                     * TypeRef symbol.
                     * @member {string} symbol
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @instance
                     */
                    TypeRef.prototype.symbol = "";

                    /**
                     * TypeRef typeArguments.
                     * @member {Array.<scala.meta.internal.semanticdb.IType>} typeArguments
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @instance
                     */
                    TypeRef.prototype.typeArguments = $util.emptyArray;

                    /**
                     * Creates a new TypeRef instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITypeRef=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.TypeRef} TypeRef instance
                     */
                    TypeRef.create = function create(properties) {
                        return new TypeRef(properties);
                    };

                    /**
                     * Encodes the specified TypeRef message. Does not implicitly {@link scala.meta.internal.semanticdb.TypeRef.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITypeRef} message TypeRef message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    TypeRef.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.prefix != null && Object.hasOwnProperty.call(message, "prefix"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.prefix, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.symbol);
                        if (message.typeArguments != null && message.typeArguments.length)
                            for (let i = 0; i < message.typeArguments.length; ++i)
                                $root.scala.meta.internal.semanticdb.Type.encode(message.typeArguments[i], writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified TypeRef message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.TypeRef.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITypeRef} message TypeRef message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    TypeRef.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a TypeRef message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.TypeRef} TypeRef
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    TypeRef.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.TypeRef();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.prefix = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.symbol = reader.string();
                                    break;
                                }
                            case 3: {
                                    if (!(message.typeArguments && message.typeArguments.length))
                                        message.typeArguments = [];
                                    message.typeArguments.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a TypeRef message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.TypeRef} TypeRef
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    TypeRef.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a TypeRef message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    TypeRef.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.prefix != null && message.hasOwnProperty("prefix")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.prefix);
                            if (error)
                                return "prefix." + error;
                        }
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            if (!$util.isString(message.symbol))
                                return "symbol: string expected";
                        if (message.typeArguments != null && message.hasOwnProperty("typeArguments")) {
                            if (!Array.isArray(message.typeArguments))
                                return "typeArguments: array expected";
                            for (let i = 0; i < message.typeArguments.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.typeArguments[i]);
                                if (error)
                                    return "typeArguments." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates a TypeRef message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.TypeRef} TypeRef
                     */
                    TypeRef.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.TypeRef)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.TypeRef();
                        if (object.prefix != null) {
                            if (typeof object.prefix !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.TypeRef.prefix: object expected");
                            message.prefix = $root.scala.meta.internal.semanticdb.Type.fromObject(object.prefix);
                        }
                        if (object.symbol != null)
                            message.symbol = String(object.symbol);
                        if (object.typeArguments) {
                            if (!Array.isArray(object.typeArguments))
                                throw TypeError(".scala.meta.internal.semanticdb.TypeRef.typeArguments: array expected");
                            message.typeArguments = [];
                            for (let i = 0; i < object.typeArguments.length; ++i) {
                                if (typeof object.typeArguments[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.TypeRef.typeArguments: object expected");
                                message.typeArguments[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.typeArguments[i]);
                            }
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a TypeRef message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @static
                     * @param {scala.meta.internal.semanticdb.TypeRef} message TypeRef
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    TypeRef.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.typeArguments = [];
                        if (options.defaults) {
                            object.prefix = null;
                            object.symbol = "";
                        }
                        if (message.prefix != null && message.hasOwnProperty("prefix"))
                            object.prefix = $root.scala.meta.internal.semanticdb.Type.toObject(message.prefix, options);
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            object.symbol = message.symbol;
                        if (message.typeArguments && message.typeArguments.length) {
                            object.typeArguments = [];
                            for (let j = 0; j < message.typeArguments.length; ++j)
                                object.typeArguments[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.typeArguments[j], options);
                        }
                        return object;
                    };

                    /**
                     * Converts this TypeRef to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    TypeRef.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for TypeRef
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.TypeRef
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    TypeRef.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.TypeRef";
                    };

                    return TypeRef;
                })();

                semanticdb.SingleType = (function() {

                    /**
                     * Properties of a SingleType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ISingleType
                     * @property {scala.meta.internal.semanticdb.IType|null} [prefix] SingleType prefix
                     * @property {string|null} [symbol] SingleType symbol
                     */

                    /**
                     * Constructs a new SingleType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a SingleType.
                     * @implements ISingleType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ISingleType=} [properties] Properties to set
                     */
                    function SingleType(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * SingleType prefix.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} prefix
                     * @memberof scala.meta.internal.semanticdb.SingleType
                     * @instance
                     */
                    SingleType.prototype.prefix = null;

                    /**
                     * SingleType symbol.
                     * @member {string} symbol
                     * @memberof scala.meta.internal.semanticdb.SingleType
                     * @instance
                     */
                    SingleType.prototype.symbol = "";

                    /**
                     * Creates a new SingleType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.SingleType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISingleType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.SingleType} SingleType instance
                     */
                    SingleType.create = function create(properties) {
                        return new SingleType(properties);
                    };

                    /**
                     * Encodes the specified SingleType message. Does not implicitly {@link scala.meta.internal.semanticdb.SingleType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.SingleType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISingleType} message SingleType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    SingleType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.prefix != null && Object.hasOwnProperty.call(message, "prefix"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.prefix, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.symbol);
                        return writer;
                    };

                    /**
                     * Encodes the specified SingleType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.SingleType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.SingleType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISingleType} message SingleType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    SingleType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a SingleType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.SingleType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.SingleType} SingleType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    SingleType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.SingleType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.prefix = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.symbol = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a SingleType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.SingleType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.SingleType} SingleType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    SingleType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a SingleType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.SingleType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    SingleType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.prefix != null && message.hasOwnProperty("prefix")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.prefix);
                            if (error)
                                return "prefix." + error;
                        }
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            if (!$util.isString(message.symbol))
                                return "symbol: string expected";
                        return null;
                    };

                    /**
                     * Creates a SingleType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.SingleType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.SingleType} SingleType
                     */
                    SingleType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.SingleType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.SingleType();
                        if (object.prefix != null) {
                            if (typeof object.prefix !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.SingleType.prefix: object expected");
                            message.prefix = $root.scala.meta.internal.semanticdb.Type.fromObject(object.prefix);
                        }
                        if (object.symbol != null)
                            message.symbol = String(object.symbol);
                        return message;
                    };

                    /**
                     * Creates a plain object from a SingleType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.SingleType
                     * @static
                     * @param {scala.meta.internal.semanticdb.SingleType} message SingleType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    SingleType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.prefix = null;
                            object.symbol = "";
                        }
                        if (message.prefix != null && message.hasOwnProperty("prefix"))
                            object.prefix = $root.scala.meta.internal.semanticdb.Type.toObject(message.prefix, options);
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            object.symbol = message.symbol;
                        return object;
                    };

                    /**
                     * Converts this SingleType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.SingleType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    SingleType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for SingleType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.SingleType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    SingleType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.SingleType";
                    };

                    return SingleType;
                })();

                semanticdb.ThisType = (function() {

                    /**
                     * Properties of a ThisType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IThisType
                     * @property {string|null} [symbol] ThisType symbol
                     */

                    /**
                     * Constructs a new ThisType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a ThisType.
                     * @implements IThisType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IThisType=} [properties] Properties to set
                     */
                    function ThisType(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ThisType symbol.
                     * @member {string} symbol
                     * @memberof scala.meta.internal.semanticdb.ThisType
                     * @instance
                     */
                    ThisType.prototype.symbol = "";

                    /**
                     * Creates a new ThisType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.ThisType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IThisType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.ThisType} ThisType instance
                     */
                    ThisType.create = function create(properties) {
                        return new ThisType(properties);
                    };

                    /**
                     * Encodes the specified ThisType message. Does not implicitly {@link scala.meta.internal.semanticdb.ThisType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.ThisType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IThisType} message ThisType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ThisType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.symbol);
                        return writer;
                    };

                    /**
                     * Encodes the specified ThisType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ThisType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ThisType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IThisType} message ThisType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ThisType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ThisType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.ThisType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.ThisType} ThisType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ThisType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ThisType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.symbol = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ThisType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ThisType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.ThisType} ThisType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ThisType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ThisType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.ThisType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ThisType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            if (!$util.isString(message.symbol))
                                return "symbol: string expected";
                        return null;
                    };

                    /**
                     * Creates a ThisType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.ThisType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.ThisType} ThisType
                     */
                    ThisType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.ThisType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.ThisType();
                        if (object.symbol != null)
                            message.symbol = String(object.symbol);
                        return message;
                    };

                    /**
                     * Creates a plain object from a ThisType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.ThisType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ThisType} message ThisType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ThisType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.symbol = "";
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            object.symbol = message.symbol;
                        return object;
                    };

                    /**
                     * Converts this ThisType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.ThisType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ThisType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ThisType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.ThisType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ThisType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.ThisType";
                    };

                    return ThisType;
                })();

                semanticdb.SuperType = (function() {

                    /**
                     * Properties of a SuperType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ISuperType
                     * @property {scala.meta.internal.semanticdb.IType|null} [prefix] SuperType prefix
                     * @property {string|null} [symbol] SuperType symbol
                     */

                    /**
                     * Constructs a new SuperType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a SuperType.
                     * @implements ISuperType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ISuperType=} [properties] Properties to set
                     */
                    function SuperType(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * SuperType prefix.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} prefix
                     * @memberof scala.meta.internal.semanticdb.SuperType
                     * @instance
                     */
                    SuperType.prototype.prefix = null;

                    /**
                     * SuperType symbol.
                     * @member {string} symbol
                     * @memberof scala.meta.internal.semanticdb.SuperType
                     * @instance
                     */
                    SuperType.prototype.symbol = "";

                    /**
                     * Creates a new SuperType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.SuperType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISuperType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.SuperType} SuperType instance
                     */
                    SuperType.create = function create(properties) {
                        return new SuperType(properties);
                    };

                    /**
                     * Encodes the specified SuperType message. Does not implicitly {@link scala.meta.internal.semanticdb.SuperType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.SuperType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISuperType} message SuperType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    SuperType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.prefix != null && Object.hasOwnProperty.call(message, "prefix"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.prefix, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.symbol);
                        return writer;
                    };

                    /**
                     * Encodes the specified SuperType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.SuperType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.SuperType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISuperType} message SuperType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    SuperType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a SuperType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.SuperType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.SuperType} SuperType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    SuperType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.SuperType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.prefix = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.symbol = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a SuperType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.SuperType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.SuperType} SuperType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    SuperType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a SuperType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.SuperType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    SuperType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.prefix != null && message.hasOwnProperty("prefix")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.prefix);
                            if (error)
                                return "prefix." + error;
                        }
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            if (!$util.isString(message.symbol))
                                return "symbol: string expected";
                        return null;
                    };

                    /**
                     * Creates a SuperType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.SuperType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.SuperType} SuperType
                     */
                    SuperType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.SuperType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.SuperType();
                        if (object.prefix != null) {
                            if (typeof object.prefix !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.SuperType.prefix: object expected");
                            message.prefix = $root.scala.meta.internal.semanticdb.Type.fromObject(object.prefix);
                        }
                        if (object.symbol != null)
                            message.symbol = String(object.symbol);
                        return message;
                    };

                    /**
                     * Creates a plain object from a SuperType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.SuperType
                     * @static
                     * @param {scala.meta.internal.semanticdb.SuperType} message SuperType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    SuperType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.prefix = null;
                            object.symbol = "";
                        }
                        if (message.prefix != null && message.hasOwnProperty("prefix"))
                            object.prefix = $root.scala.meta.internal.semanticdb.Type.toObject(message.prefix, options);
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            object.symbol = message.symbol;
                        return object;
                    };

                    /**
                     * Converts this SuperType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.SuperType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    SuperType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for SuperType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.SuperType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    SuperType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.SuperType";
                    };

                    return SuperType;
                })();

                semanticdb.ConstantType = (function() {

                    /**
                     * Properties of a ConstantType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IConstantType
                     * @property {scala.meta.internal.semanticdb.IConstant|null} [constant] ConstantType constant
                     */

                    /**
                     * Constructs a new ConstantType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a ConstantType.
                     * @implements IConstantType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IConstantType=} [properties] Properties to set
                     */
                    function ConstantType(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ConstantType constant.
                     * @member {scala.meta.internal.semanticdb.IConstant|null|undefined} constant
                     * @memberof scala.meta.internal.semanticdb.ConstantType
                     * @instance
                     */
                    ConstantType.prototype.constant = null;

                    /**
                     * Creates a new ConstantType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.ConstantType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IConstantType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.ConstantType} ConstantType instance
                     */
                    ConstantType.create = function create(properties) {
                        return new ConstantType(properties);
                    };

                    /**
                     * Encodes the specified ConstantType message. Does not implicitly {@link scala.meta.internal.semanticdb.ConstantType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.ConstantType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IConstantType} message ConstantType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ConstantType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.constant != null && Object.hasOwnProperty.call(message, "constant"))
                            $root.scala.meta.internal.semanticdb.Constant.encode(message.constant, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified ConstantType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ConstantType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ConstantType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IConstantType} message ConstantType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ConstantType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ConstantType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.ConstantType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.ConstantType} ConstantType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ConstantType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ConstantType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.constant = $root.scala.meta.internal.semanticdb.Constant.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ConstantType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ConstantType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.ConstantType} ConstantType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ConstantType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ConstantType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.ConstantType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ConstantType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.constant != null && message.hasOwnProperty("constant")) {
                            let error = $root.scala.meta.internal.semanticdb.Constant.verify(message.constant);
                            if (error)
                                return "constant." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a ConstantType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.ConstantType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.ConstantType} ConstantType
                     */
                    ConstantType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.ConstantType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.ConstantType();
                        if (object.constant != null) {
                            if (typeof object.constant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.ConstantType.constant: object expected");
                            message.constant = $root.scala.meta.internal.semanticdb.Constant.fromObject(object.constant);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a ConstantType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.ConstantType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ConstantType} message ConstantType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ConstantType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.constant = null;
                        if (message.constant != null && message.hasOwnProperty("constant"))
                            object.constant = $root.scala.meta.internal.semanticdb.Constant.toObject(message.constant, options);
                        return object;
                    };

                    /**
                     * Converts this ConstantType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.ConstantType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ConstantType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ConstantType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.ConstantType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ConstantType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.ConstantType";
                    };

                    return ConstantType;
                })();

                semanticdb.IntersectionType = (function() {

                    /**
                     * Properties of an IntersectionType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IIntersectionType
                     * @property {Array.<scala.meta.internal.semanticdb.IType>|null} [types] IntersectionType types
                     */

                    /**
                     * Constructs a new IntersectionType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an IntersectionType.
                     * @implements IIntersectionType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IIntersectionType=} [properties] Properties to set
                     */
                    function IntersectionType(properties) {
                        this.types = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * IntersectionType types.
                     * @member {Array.<scala.meta.internal.semanticdb.IType>} types
                     * @memberof scala.meta.internal.semanticdb.IntersectionType
                     * @instance
                     */
                    IntersectionType.prototype.types = $util.emptyArray;

                    /**
                     * Creates a new IntersectionType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.IntersectionType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IIntersectionType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.IntersectionType} IntersectionType instance
                     */
                    IntersectionType.create = function create(properties) {
                        return new IntersectionType(properties);
                    };

                    /**
                     * Encodes the specified IntersectionType message. Does not implicitly {@link scala.meta.internal.semanticdb.IntersectionType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.IntersectionType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IIntersectionType} message IntersectionType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    IntersectionType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.types != null && message.types.length)
                            for (let i = 0; i < message.types.length; ++i)
                                $root.scala.meta.internal.semanticdb.Type.encode(message.types[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified IntersectionType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.IntersectionType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.IntersectionType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IIntersectionType} message IntersectionType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    IntersectionType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an IntersectionType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.IntersectionType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.IntersectionType} IntersectionType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    IntersectionType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.IntersectionType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    if (!(message.types && message.types.length))
                                        message.types = [];
                                    message.types.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an IntersectionType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.IntersectionType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.IntersectionType} IntersectionType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    IntersectionType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an IntersectionType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.IntersectionType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    IntersectionType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.types != null && message.hasOwnProperty("types")) {
                            if (!Array.isArray(message.types))
                                return "types: array expected";
                            for (let i = 0; i < message.types.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.types[i]);
                                if (error)
                                    return "types." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates an IntersectionType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.IntersectionType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.IntersectionType} IntersectionType
                     */
                    IntersectionType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.IntersectionType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.IntersectionType();
                        if (object.types) {
                            if (!Array.isArray(object.types))
                                throw TypeError(".scala.meta.internal.semanticdb.IntersectionType.types: array expected");
                            message.types = [];
                            for (let i = 0; i < object.types.length; ++i) {
                                if (typeof object.types[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.IntersectionType.types: object expected");
                                message.types[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.types[i]);
                            }
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from an IntersectionType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.IntersectionType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IntersectionType} message IntersectionType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    IntersectionType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.types = [];
                        if (message.types && message.types.length) {
                            object.types = [];
                            for (let j = 0; j < message.types.length; ++j)
                                object.types[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.types[j], options);
                        }
                        return object;
                    };

                    /**
                     * Converts this IntersectionType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.IntersectionType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    IntersectionType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for IntersectionType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.IntersectionType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    IntersectionType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.IntersectionType";
                    };

                    return IntersectionType;
                })();

                semanticdb.UnionType = (function() {

                    /**
                     * Properties of an UnionType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IUnionType
                     * @property {Array.<scala.meta.internal.semanticdb.IType>|null} [types] UnionType types
                     */

                    /**
                     * Constructs a new UnionType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an UnionType.
                     * @implements IUnionType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IUnionType=} [properties] Properties to set
                     */
                    function UnionType(properties) {
                        this.types = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * UnionType types.
                     * @member {Array.<scala.meta.internal.semanticdb.IType>} types
                     * @memberof scala.meta.internal.semanticdb.UnionType
                     * @instance
                     */
                    UnionType.prototype.types = $util.emptyArray;

                    /**
                     * Creates a new UnionType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.UnionType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IUnionType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.UnionType} UnionType instance
                     */
                    UnionType.create = function create(properties) {
                        return new UnionType(properties);
                    };

                    /**
                     * Encodes the specified UnionType message. Does not implicitly {@link scala.meta.internal.semanticdb.UnionType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.UnionType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IUnionType} message UnionType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    UnionType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.types != null && message.types.length)
                            for (let i = 0; i < message.types.length; ++i)
                                $root.scala.meta.internal.semanticdb.Type.encode(message.types[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified UnionType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.UnionType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.UnionType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IUnionType} message UnionType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    UnionType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an UnionType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.UnionType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.UnionType} UnionType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    UnionType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.UnionType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    if (!(message.types && message.types.length))
                                        message.types = [];
                                    message.types.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an UnionType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.UnionType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.UnionType} UnionType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    UnionType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an UnionType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.UnionType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    UnionType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.types != null && message.hasOwnProperty("types")) {
                            if (!Array.isArray(message.types))
                                return "types: array expected";
                            for (let i = 0; i < message.types.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.types[i]);
                                if (error)
                                    return "types." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates an UnionType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.UnionType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.UnionType} UnionType
                     */
                    UnionType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.UnionType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.UnionType();
                        if (object.types) {
                            if (!Array.isArray(object.types))
                                throw TypeError(".scala.meta.internal.semanticdb.UnionType.types: array expected");
                            message.types = [];
                            for (let i = 0; i < object.types.length; ++i) {
                                if (typeof object.types[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.UnionType.types: object expected");
                                message.types[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.types[i]);
                            }
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from an UnionType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.UnionType
                     * @static
                     * @param {scala.meta.internal.semanticdb.UnionType} message UnionType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    UnionType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.types = [];
                        if (message.types && message.types.length) {
                            object.types = [];
                            for (let j = 0; j < message.types.length; ++j)
                                object.types[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.types[j], options);
                        }
                        return object;
                    };

                    /**
                     * Converts this UnionType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.UnionType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    UnionType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for UnionType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.UnionType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    UnionType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.UnionType";
                    };

                    return UnionType;
                })();

                semanticdb.WithType = (function() {

                    /**
                     * Properties of a WithType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IWithType
                     * @property {Array.<scala.meta.internal.semanticdb.IType>|null} [types] WithType types
                     */

                    /**
                     * Constructs a new WithType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a WithType.
                     * @implements IWithType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IWithType=} [properties] Properties to set
                     */
                    function WithType(properties) {
                        this.types = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * WithType types.
                     * @member {Array.<scala.meta.internal.semanticdb.IType>} types
                     * @memberof scala.meta.internal.semanticdb.WithType
                     * @instance
                     */
                    WithType.prototype.types = $util.emptyArray;

                    /**
                     * Creates a new WithType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.WithType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IWithType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.WithType} WithType instance
                     */
                    WithType.create = function create(properties) {
                        return new WithType(properties);
                    };

                    /**
                     * Encodes the specified WithType message. Does not implicitly {@link scala.meta.internal.semanticdb.WithType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.WithType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IWithType} message WithType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    WithType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.types != null && message.types.length)
                            for (let i = 0; i < message.types.length; ++i)
                                $root.scala.meta.internal.semanticdb.Type.encode(message.types[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified WithType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.WithType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.WithType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IWithType} message WithType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    WithType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a WithType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.WithType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.WithType} WithType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    WithType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.WithType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    if (!(message.types && message.types.length))
                                        message.types = [];
                                    message.types.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a WithType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.WithType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.WithType} WithType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    WithType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a WithType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.WithType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    WithType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.types != null && message.hasOwnProperty("types")) {
                            if (!Array.isArray(message.types))
                                return "types: array expected";
                            for (let i = 0; i < message.types.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.types[i]);
                                if (error)
                                    return "types." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates a WithType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.WithType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.WithType} WithType
                     */
                    WithType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.WithType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.WithType();
                        if (object.types) {
                            if (!Array.isArray(object.types))
                                throw TypeError(".scala.meta.internal.semanticdb.WithType.types: array expected");
                            message.types = [];
                            for (let i = 0; i < object.types.length; ++i) {
                                if (typeof object.types[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.WithType.types: object expected");
                                message.types[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.types[i]);
                            }
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a WithType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.WithType
                     * @static
                     * @param {scala.meta.internal.semanticdb.WithType} message WithType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    WithType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.types = [];
                        if (message.types && message.types.length) {
                            object.types = [];
                            for (let j = 0; j < message.types.length; ++j)
                                object.types[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.types[j], options);
                        }
                        return object;
                    };

                    /**
                     * Converts this WithType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.WithType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    WithType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for WithType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.WithType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    WithType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.WithType";
                    };

                    return WithType;
                })();

                semanticdb.StructuralType = (function() {

                    /**
                     * Properties of a StructuralType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IStructuralType
                     * @property {scala.meta.internal.semanticdb.IType|null} [tpe] StructuralType tpe
                     * @property {scala.meta.internal.semanticdb.IScope|null} [declarations] StructuralType declarations
                     */

                    /**
                     * Constructs a new StructuralType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a StructuralType.
                     * @implements IStructuralType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IStructuralType=} [properties] Properties to set
                     */
                    function StructuralType(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * StructuralType tpe.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} tpe
                     * @memberof scala.meta.internal.semanticdb.StructuralType
                     * @instance
                     */
                    StructuralType.prototype.tpe = null;

                    /**
                     * StructuralType declarations.
                     * @member {scala.meta.internal.semanticdb.IScope|null|undefined} declarations
                     * @memberof scala.meta.internal.semanticdb.StructuralType
                     * @instance
                     */
                    StructuralType.prototype.declarations = null;

                    /**
                     * Creates a new StructuralType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.StructuralType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IStructuralType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.StructuralType} StructuralType instance
                     */
                    StructuralType.create = function create(properties) {
                        return new StructuralType(properties);
                    };

                    /**
                     * Encodes the specified StructuralType message. Does not implicitly {@link scala.meta.internal.semanticdb.StructuralType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.StructuralType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IStructuralType} message StructuralType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    StructuralType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
                        if (message.declarations != null && Object.hasOwnProperty.call(message, "declarations"))
                            $root.scala.meta.internal.semanticdb.Scope.encode(message.declarations, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified StructuralType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.StructuralType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.StructuralType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IStructuralType} message StructuralType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    StructuralType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a StructuralType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.StructuralType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.StructuralType} StructuralType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    StructuralType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.StructuralType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 4: {
                                    message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            case 5: {
                                    message.declarations = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a StructuralType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.StructuralType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.StructuralType} StructuralType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    StructuralType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a StructuralType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.StructuralType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    StructuralType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.tpe != null && message.hasOwnProperty("tpe")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
                            if (error)
                                return "tpe." + error;
                        }
                        if (message.declarations != null && message.hasOwnProperty("declarations")) {
                            let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.declarations);
                            if (error)
                                return "declarations." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a StructuralType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.StructuralType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.StructuralType} StructuralType
                     */
                    StructuralType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.StructuralType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.StructuralType();
                        if (object.tpe != null) {
                            if (typeof object.tpe !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.StructuralType.tpe: object expected");
                            message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
                        }
                        if (object.declarations != null) {
                            if (typeof object.declarations !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.StructuralType.declarations: object expected");
                            message.declarations = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.declarations);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a StructuralType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.StructuralType
                     * @static
                     * @param {scala.meta.internal.semanticdb.StructuralType} message StructuralType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    StructuralType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.tpe = null;
                            object.declarations = null;
                        }
                        if (message.tpe != null && message.hasOwnProperty("tpe"))
                            object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
                        if (message.declarations != null && message.hasOwnProperty("declarations"))
                            object.declarations = $root.scala.meta.internal.semanticdb.Scope.toObject(message.declarations, options);
                        return object;
                    };

                    /**
                     * Converts this StructuralType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.StructuralType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    StructuralType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for StructuralType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.StructuralType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    StructuralType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.StructuralType";
                    };

                    return StructuralType;
                })();

                semanticdb.AnnotatedType = (function() {

                    /**
                     * Properties of an AnnotatedType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IAnnotatedType
                     * @property {Array.<scala.meta.internal.semanticdb.IAnnotationTree>|null} [annotations] AnnotatedType annotations
                     * @property {scala.meta.internal.semanticdb.IType|null} [tpe] AnnotatedType tpe
                     */

                    /**
                     * Constructs a new AnnotatedType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an AnnotatedType.
                     * @implements IAnnotatedType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IAnnotatedType=} [properties] Properties to set
                     */
                    function AnnotatedType(properties) {
                        this.annotations = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * AnnotatedType annotations.
                     * @member {Array.<scala.meta.internal.semanticdb.IAnnotationTree>} annotations
                     * @memberof scala.meta.internal.semanticdb.AnnotatedType
                     * @instance
                     */
                    AnnotatedType.prototype.annotations = $util.emptyArray;

                    /**
                     * AnnotatedType tpe.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} tpe
                     * @memberof scala.meta.internal.semanticdb.AnnotatedType
                     * @instance
                     */
                    AnnotatedType.prototype.tpe = null;

                    /**
                     * Creates a new AnnotatedType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.AnnotatedType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IAnnotatedType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.AnnotatedType} AnnotatedType instance
                     */
                    AnnotatedType.create = function create(properties) {
                        return new AnnotatedType(properties);
                    };

                    /**
                     * Encodes the specified AnnotatedType message. Does not implicitly {@link scala.meta.internal.semanticdb.AnnotatedType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.AnnotatedType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IAnnotatedType} message AnnotatedType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    AnnotatedType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.annotations != null && message.annotations.length)
                            for (let i = 0; i < message.annotations.length; ++i)
                                $root.scala.meta.internal.semanticdb.AnnotationTree.encode(message.annotations[i], writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified AnnotatedType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.AnnotatedType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.AnnotatedType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IAnnotatedType} message AnnotatedType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    AnnotatedType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an AnnotatedType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.AnnotatedType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.AnnotatedType} AnnotatedType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    AnnotatedType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.AnnotatedType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 3: {
                                    if (!(message.annotations && message.annotations.length))
                                        message.annotations = [];
                                    message.annotations.push($root.scala.meta.internal.semanticdb.AnnotationTree.decode(reader, reader.uint32()));
                                    break;
                                }
                            case 1: {
                                    message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an AnnotatedType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.AnnotatedType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.AnnotatedType} AnnotatedType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    AnnotatedType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an AnnotatedType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.AnnotatedType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    AnnotatedType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.annotations != null && message.hasOwnProperty("annotations")) {
                            if (!Array.isArray(message.annotations))
                                return "annotations: array expected";
                            for (let i = 0; i < message.annotations.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.AnnotationTree.verify(message.annotations[i]);
                                if (error)
                                    return "annotations." + error;
                            }
                        }
                        if (message.tpe != null && message.hasOwnProperty("tpe")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
                            if (error)
                                return "tpe." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates an AnnotatedType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.AnnotatedType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.AnnotatedType} AnnotatedType
                     */
                    AnnotatedType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.AnnotatedType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.AnnotatedType();
                        if (object.annotations) {
                            if (!Array.isArray(object.annotations))
                                throw TypeError(".scala.meta.internal.semanticdb.AnnotatedType.annotations: array expected");
                            message.annotations = [];
                            for (let i = 0; i < object.annotations.length; ++i) {
                                if (typeof object.annotations[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.AnnotatedType.annotations: object expected");
                                message.annotations[i] = $root.scala.meta.internal.semanticdb.AnnotationTree.fromObject(object.annotations[i]);
                            }
                        }
                        if (object.tpe != null) {
                            if (typeof object.tpe !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.AnnotatedType.tpe: object expected");
                            message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from an AnnotatedType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.AnnotatedType
                     * @static
                     * @param {scala.meta.internal.semanticdb.AnnotatedType} message AnnotatedType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    AnnotatedType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.annotations = [];
                        if (options.defaults)
                            object.tpe = null;
                        if (message.tpe != null && message.hasOwnProperty("tpe"))
                            object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
                        if (message.annotations && message.annotations.length) {
                            object.annotations = [];
                            for (let j = 0; j < message.annotations.length; ++j)
                                object.annotations[j] = $root.scala.meta.internal.semanticdb.AnnotationTree.toObject(message.annotations[j], options);
                        }
                        return object;
                    };

                    /**
                     * Converts this AnnotatedType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.AnnotatedType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    AnnotatedType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for AnnotatedType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.AnnotatedType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    AnnotatedType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.AnnotatedType";
                    };

                    return AnnotatedType;
                })();

                semanticdb.ExistentialType = (function() {

                    /**
                     * Properties of an ExistentialType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IExistentialType
                     * @property {scala.meta.internal.semanticdb.IType|null} [tpe] ExistentialType tpe
                     * @property {scala.meta.internal.semanticdb.IScope|null} [declarations] ExistentialType declarations
                     */

                    /**
                     * Constructs a new ExistentialType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an ExistentialType.
                     * @implements IExistentialType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IExistentialType=} [properties] Properties to set
                     */
                    function ExistentialType(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ExistentialType tpe.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} tpe
                     * @memberof scala.meta.internal.semanticdb.ExistentialType
                     * @instance
                     */
                    ExistentialType.prototype.tpe = null;

                    /**
                     * ExistentialType declarations.
                     * @member {scala.meta.internal.semanticdb.IScope|null|undefined} declarations
                     * @memberof scala.meta.internal.semanticdb.ExistentialType
                     * @instance
                     */
                    ExistentialType.prototype.declarations = null;

                    /**
                     * Creates a new ExistentialType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.ExistentialType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IExistentialType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.ExistentialType} ExistentialType instance
                     */
                    ExistentialType.create = function create(properties) {
                        return new ExistentialType(properties);
                    };

                    /**
                     * Encodes the specified ExistentialType message. Does not implicitly {@link scala.meta.internal.semanticdb.ExistentialType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.ExistentialType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IExistentialType} message ExistentialType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ExistentialType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.declarations != null && Object.hasOwnProperty.call(message, "declarations"))
                            $root.scala.meta.internal.semanticdb.Scope.encode(message.declarations, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified ExistentialType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ExistentialType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ExistentialType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IExistentialType} message ExistentialType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ExistentialType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an ExistentialType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.ExistentialType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.ExistentialType} ExistentialType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ExistentialType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ExistentialType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            case 3: {
                                    message.declarations = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an ExistentialType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ExistentialType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.ExistentialType} ExistentialType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ExistentialType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an ExistentialType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.ExistentialType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ExistentialType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.tpe != null && message.hasOwnProperty("tpe")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
                            if (error)
                                return "tpe." + error;
                        }
                        if (message.declarations != null && message.hasOwnProperty("declarations")) {
                            let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.declarations);
                            if (error)
                                return "declarations." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates an ExistentialType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.ExistentialType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.ExistentialType} ExistentialType
                     */
                    ExistentialType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.ExistentialType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.ExistentialType();
                        if (object.tpe != null) {
                            if (typeof object.tpe !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.ExistentialType.tpe: object expected");
                            message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
                        }
                        if (object.declarations != null) {
                            if (typeof object.declarations !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.ExistentialType.declarations: object expected");
                            message.declarations = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.declarations);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from an ExistentialType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.ExistentialType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ExistentialType} message ExistentialType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ExistentialType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.tpe = null;
                            object.declarations = null;
                        }
                        if (message.tpe != null && message.hasOwnProperty("tpe"))
                            object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
                        if (message.declarations != null && message.hasOwnProperty("declarations"))
                            object.declarations = $root.scala.meta.internal.semanticdb.Scope.toObject(message.declarations, options);
                        return object;
                    };

                    /**
                     * Converts this ExistentialType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.ExistentialType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ExistentialType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ExistentialType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.ExistentialType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ExistentialType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.ExistentialType";
                    };

                    return ExistentialType;
                })();

                semanticdb.UniversalType = (function() {

                    /**
                     * Properties of an UniversalType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IUniversalType
                     * @property {scala.meta.internal.semanticdb.IScope|null} [typeParameters] UniversalType typeParameters
                     * @property {scala.meta.internal.semanticdb.IType|null} [tpe] UniversalType tpe
                     */

                    /**
                     * Constructs a new UniversalType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an UniversalType.
                     * @implements IUniversalType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IUniversalType=} [properties] Properties to set
                     */
                    function UniversalType(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * UniversalType typeParameters.
                     * @member {scala.meta.internal.semanticdb.IScope|null|undefined} typeParameters
                     * @memberof scala.meta.internal.semanticdb.UniversalType
                     * @instance
                     */
                    UniversalType.prototype.typeParameters = null;

                    /**
                     * UniversalType tpe.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} tpe
                     * @memberof scala.meta.internal.semanticdb.UniversalType
                     * @instance
                     */
                    UniversalType.prototype.tpe = null;

                    /**
                     * Creates a new UniversalType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.UniversalType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IUniversalType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.UniversalType} UniversalType instance
                     */
                    UniversalType.create = function create(properties) {
                        return new UniversalType(properties);
                    };

                    /**
                     * Encodes the specified UniversalType message. Does not implicitly {@link scala.meta.internal.semanticdb.UniversalType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.UniversalType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IUniversalType} message UniversalType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    UniversalType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.typeParameters != null && Object.hasOwnProperty.call(message, "typeParameters"))
                            $root.scala.meta.internal.semanticdb.Scope.encode(message.typeParameters, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified UniversalType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.UniversalType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.UniversalType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IUniversalType} message UniversalType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    UniversalType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an UniversalType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.UniversalType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.UniversalType} UniversalType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    UniversalType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.UniversalType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 3: {
                                    message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an UniversalType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.UniversalType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.UniversalType} UniversalType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    UniversalType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an UniversalType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.UniversalType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    UniversalType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.typeParameters != null && message.hasOwnProperty("typeParameters")) {
                            let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.typeParameters);
                            if (error)
                                return "typeParameters." + error;
                        }
                        if (message.tpe != null && message.hasOwnProperty("tpe")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
                            if (error)
                                return "tpe." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates an UniversalType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.UniversalType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.UniversalType} UniversalType
                     */
                    UniversalType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.UniversalType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.UniversalType();
                        if (object.typeParameters != null) {
                            if (typeof object.typeParameters !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.UniversalType.typeParameters: object expected");
                            message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.typeParameters);
                        }
                        if (object.tpe != null) {
                            if (typeof object.tpe !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.UniversalType.tpe: object expected");
                            message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from an UniversalType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.UniversalType
                     * @static
                     * @param {scala.meta.internal.semanticdb.UniversalType} message UniversalType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    UniversalType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.tpe = null;
                            object.typeParameters = null;
                        }
                        if (message.tpe != null && message.hasOwnProperty("tpe"))
                            object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
                        if (message.typeParameters != null && message.hasOwnProperty("typeParameters"))
                            object.typeParameters = $root.scala.meta.internal.semanticdb.Scope.toObject(message.typeParameters, options);
                        return object;
                    };

                    /**
                     * Converts this UniversalType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.UniversalType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    UniversalType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for UniversalType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.UniversalType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    UniversalType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.UniversalType";
                    };

                    return UniversalType;
                })();

                semanticdb.ByNameType = (function() {

                    /**
                     * Properties of a ByNameType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IByNameType
                     * @property {scala.meta.internal.semanticdb.IType|null} [tpe] ByNameType tpe
                     */

                    /**
                     * Constructs a new ByNameType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a ByNameType.
                     * @implements IByNameType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IByNameType=} [properties] Properties to set
                     */
                    function ByNameType(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ByNameType tpe.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} tpe
                     * @memberof scala.meta.internal.semanticdb.ByNameType
                     * @instance
                     */
                    ByNameType.prototype.tpe = null;

                    /**
                     * Creates a new ByNameType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.ByNameType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IByNameType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.ByNameType} ByNameType instance
                     */
                    ByNameType.create = function create(properties) {
                        return new ByNameType(properties);
                    };

                    /**
                     * Encodes the specified ByNameType message. Does not implicitly {@link scala.meta.internal.semanticdb.ByNameType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.ByNameType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IByNameType} message ByNameType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ByNameType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified ByNameType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ByNameType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ByNameType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IByNameType} message ByNameType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ByNameType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ByNameType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.ByNameType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.ByNameType} ByNameType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ByNameType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ByNameType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ByNameType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ByNameType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.ByNameType} ByNameType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ByNameType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ByNameType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.ByNameType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ByNameType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.tpe != null && message.hasOwnProperty("tpe")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
                            if (error)
                                return "tpe." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a ByNameType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.ByNameType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.ByNameType} ByNameType
                     */
                    ByNameType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.ByNameType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.ByNameType();
                        if (object.tpe != null) {
                            if (typeof object.tpe !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.ByNameType.tpe: object expected");
                            message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a ByNameType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.ByNameType
                     * @static
                     * @param {scala.meta.internal.semanticdb.ByNameType} message ByNameType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ByNameType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.tpe = null;
                        if (message.tpe != null && message.hasOwnProperty("tpe"))
                            object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
                        return object;
                    };

                    /**
                     * Converts this ByNameType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.ByNameType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ByNameType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ByNameType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.ByNameType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ByNameType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.ByNameType";
                    };

                    return ByNameType;
                })();

                semanticdb.RepeatedType = (function() {

                    /**
                     * Properties of a RepeatedType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IRepeatedType
                     * @property {scala.meta.internal.semanticdb.IType|null} [tpe] RepeatedType tpe
                     */

                    /**
                     * Constructs a new RepeatedType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a RepeatedType.
                     * @implements IRepeatedType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IRepeatedType=} [properties] Properties to set
                     */
                    function RepeatedType(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * RepeatedType tpe.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} tpe
                     * @memberof scala.meta.internal.semanticdb.RepeatedType
                     * @instance
                     */
                    RepeatedType.prototype.tpe = null;

                    /**
                     * Creates a new RepeatedType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.RepeatedType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IRepeatedType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.RepeatedType} RepeatedType instance
                     */
                    RepeatedType.create = function create(properties) {
                        return new RepeatedType(properties);
                    };

                    /**
                     * Encodes the specified RepeatedType message. Does not implicitly {@link scala.meta.internal.semanticdb.RepeatedType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.RepeatedType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IRepeatedType} message RepeatedType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    RepeatedType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified RepeatedType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.RepeatedType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.RepeatedType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IRepeatedType} message RepeatedType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    RepeatedType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a RepeatedType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.RepeatedType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.RepeatedType} RepeatedType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    RepeatedType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.RepeatedType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a RepeatedType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.RepeatedType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.RepeatedType} RepeatedType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    RepeatedType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a RepeatedType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.RepeatedType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    RepeatedType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.tpe != null && message.hasOwnProperty("tpe")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
                            if (error)
                                return "tpe." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a RepeatedType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.RepeatedType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.RepeatedType} RepeatedType
                     */
                    RepeatedType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.RepeatedType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.RepeatedType();
                        if (object.tpe != null) {
                            if (typeof object.tpe !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.RepeatedType.tpe: object expected");
                            message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a RepeatedType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.RepeatedType
                     * @static
                     * @param {scala.meta.internal.semanticdb.RepeatedType} message RepeatedType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    RepeatedType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.tpe = null;
                        if (message.tpe != null && message.hasOwnProperty("tpe"))
                            object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
                        return object;
                    };

                    /**
                     * Converts this RepeatedType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.RepeatedType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    RepeatedType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for RepeatedType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.RepeatedType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    RepeatedType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.RepeatedType";
                    };

                    return RepeatedType;
                })();

                semanticdb.MatchType = (function() {

                    /**
                     * Properties of a MatchType.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IMatchType
                     * @property {scala.meta.internal.semanticdb.IType|null} [scrutinee] MatchType scrutinee
                     * @property {Array.<scala.meta.internal.semanticdb.MatchType.ICaseType>|null} [cases] MatchType cases
                     */

                    /**
                     * Constructs a new MatchType.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a MatchType.
                     * @implements IMatchType
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IMatchType=} [properties] Properties to set
                     */
                    function MatchType(properties) {
                        this.cases = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * MatchType scrutinee.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} scrutinee
                     * @memberof scala.meta.internal.semanticdb.MatchType
                     * @instance
                     */
                    MatchType.prototype.scrutinee = null;

                    /**
                     * MatchType cases.
                     * @member {Array.<scala.meta.internal.semanticdb.MatchType.ICaseType>} cases
                     * @memberof scala.meta.internal.semanticdb.MatchType
                     * @instance
                     */
                    MatchType.prototype.cases = $util.emptyArray;

                    /**
                     * Creates a new MatchType instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.MatchType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IMatchType=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.MatchType} MatchType instance
                     */
                    MatchType.create = function create(properties) {
                        return new MatchType(properties);
                    };

                    /**
                     * Encodes the specified MatchType message. Does not implicitly {@link scala.meta.internal.semanticdb.MatchType.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.MatchType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IMatchType} message MatchType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    MatchType.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.scrutinee != null && Object.hasOwnProperty.call(message, "scrutinee"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.scrutinee, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.cases != null && message.cases.length)
                            for (let i = 0; i < message.cases.length; ++i)
                                $root.scala.meta.internal.semanticdb.MatchType.CaseType.encode(message.cases[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified MatchType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.MatchType.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.MatchType
                     * @static
                     * @param {scala.meta.internal.semanticdb.IMatchType} message MatchType message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    MatchType.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a MatchType message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.MatchType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.MatchType} MatchType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    MatchType.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.MatchType();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.scrutinee = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    if (!(message.cases && message.cases.length))
                                        message.cases = [];
                                    message.cases.push($root.scala.meta.internal.semanticdb.MatchType.CaseType.decode(reader, reader.uint32()));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a MatchType message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.MatchType
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.MatchType} MatchType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    MatchType.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a MatchType message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.MatchType
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    MatchType.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.scrutinee != null && message.hasOwnProperty("scrutinee")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.scrutinee);
                            if (error)
                                return "scrutinee." + error;
                        }
                        if (message.cases != null && message.hasOwnProperty("cases")) {
                            if (!Array.isArray(message.cases))
                                return "cases: array expected";
                            for (let i = 0; i < message.cases.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.MatchType.CaseType.verify(message.cases[i]);
                                if (error)
                                    return "cases." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates a MatchType message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.MatchType
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.MatchType} MatchType
                     */
                    MatchType.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.MatchType)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.MatchType();
                        if (object.scrutinee != null) {
                            if (typeof object.scrutinee !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.MatchType.scrutinee: object expected");
                            message.scrutinee = $root.scala.meta.internal.semanticdb.Type.fromObject(object.scrutinee);
                        }
                        if (object.cases) {
                            if (!Array.isArray(object.cases))
                                throw TypeError(".scala.meta.internal.semanticdb.MatchType.cases: array expected");
                            message.cases = [];
                            for (let i = 0; i < object.cases.length; ++i) {
                                if (typeof object.cases[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.MatchType.cases: object expected");
                                message.cases[i] = $root.scala.meta.internal.semanticdb.MatchType.CaseType.fromObject(object.cases[i]);
                            }
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a MatchType message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.MatchType
                     * @static
                     * @param {scala.meta.internal.semanticdb.MatchType} message MatchType
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    MatchType.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.cases = [];
                        if (options.defaults)
                            object.scrutinee = null;
                        if (message.scrutinee != null && message.hasOwnProperty("scrutinee"))
                            object.scrutinee = $root.scala.meta.internal.semanticdb.Type.toObject(message.scrutinee, options);
                        if (message.cases && message.cases.length) {
                            object.cases = [];
                            for (let j = 0; j < message.cases.length; ++j)
                                object.cases[j] = $root.scala.meta.internal.semanticdb.MatchType.CaseType.toObject(message.cases[j], options);
                        }
                        return object;
                    };

                    /**
                     * Converts this MatchType to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.MatchType
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    MatchType.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for MatchType
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.MatchType
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    MatchType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.MatchType";
                    };

                    MatchType.CaseType = (function() {

                        /**
                         * Properties of a CaseType.
                         * @memberof scala.meta.internal.semanticdb.MatchType
                         * @interface ICaseType
                         * @property {scala.meta.internal.semanticdb.IType|null} [key] CaseType key
                         * @property {scala.meta.internal.semanticdb.IType|null} [body] CaseType body
                         */

                        /**
                         * Constructs a new CaseType.
                         * @memberof scala.meta.internal.semanticdb.MatchType
                         * @classdesc Represents a CaseType.
                         * @implements ICaseType
                         * @constructor
                         * @param {scala.meta.internal.semanticdb.MatchType.ICaseType=} [properties] Properties to set
                         */
                        function CaseType(properties) {
                            if (properties)
                                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                    if (properties[keys[i]] != null)
                                        this[keys[i]] = properties[keys[i]];
                        }

                        /**
                         * CaseType key.
                         * @member {scala.meta.internal.semanticdb.IType|null|undefined} key
                         * @memberof scala.meta.internal.semanticdb.MatchType.CaseType
                         * @instance
                         */
                        CaseType.prototype.key = null;

                        /**
                         * CaseType body.
                         * @member {scala.meta.internal.semanticdb.IType|null|undefined} body
                         * @memberof scala.meta.internal.semanticdb.MatchType.CaseType
                         * @instance
                         */
                        CaseType.prototype.body = null;

                        /**
                         * Creates a new CaseType instance using the specified properties.
                         * @function create
                         * @memberof scala.meta.internal.semanticdb.MatchType.CaseType
                         * @static
                         * @param {scala.meta.internal.semanticdb.MatchType.ICaseType=} [properties] Properties to set
                         * @returns {scala.meta.internal.semanticdb.MatchType.CaseType} CaseType instance
                         */
                        CaseType.create = function create(properties) {
                            return new CaseType(properties);
                        };

                        /**
                         * Encodes the specified CaseType message. Does not implicitly {@link scala.meta.internal.semanticdb.MatchType.CaseType.verify|verify} messages.
                         * @function encode
                         * @memberof scala.meta.internal.semanticdb.MatchType.CaseType
                         * @static
                         * @param {scala.meta.internal.semanticdb.MatchType.ICaseType} message CaseType message or plain object to encode
                         * @param {$protobuf.Writer} [writer] Writer to encode to
                         * @returns {$protobuf.Writer} Writer
                         */
                        CaseType.encode = function encode(message, writer) {
                            if (!writer)
                                writer = $Writer.create();
                            if (message.key != null && Object.hasOwnProperty.call(message, "key"))
                                $root.scala.meta.internal.semanticdb.Type.encode(message.key, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                            if (message.body != null && Object.hasOwnProperty.call(message, "body"))
                                $root.scala.meta.internal.semanticdb.Type.encode(message.body, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                            return writer;
                        };

                        /**
                         * Encodes the specified CaseType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.MatchType.CaseType.verify|verify} messages.
                         * @function encodeDelimited
                         * @memberof scala.meta.internal.semanticdb.MatchType.CaseType
                         * @static
                         * @param {scala.meta.internal.semanticdb.MatchType.ICaseType} message CaseType message or plain object to encode
                         * @param {$protobuf.Writer} [writer] Writer to encode to
                         * @returns {$protobuf.Writer} Writer
                         */
                        CaseType.encodeDelimited = function encodeDelimited(message, writer) {
                            return this.encode(message, writer).ldelim();
                        };

                        /**
                         * Decodes a CaseType message from the specified reader or buffer.
                         * @function decode
                         * @memberof scala.meta.internal.semanticdb.MatchType.CaseType
                         * @static
                         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                         * @param {number} [length] Message length if known beforehand
                         * @returns {scala.meta.internal.semanticdb.MatchType.CaseType} CaseType
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        CaseType.decode = function decode(reader, length, error) {
                            if (!(reader instanceof $Reader))
                                reader = $Reader.create(reader);
                            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.MatchType.CaseType();
                            while (reader.pos < end) {
                                let tag = reader.uint32();
                                if (tag === error)
                                    break;
                                switch (tag >>> 3) {
                                case 1: {
                                        message.key = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                        break;
                                    }
                                case 2: {
                                        message.body = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                        break;
                                    }
                                default:
                                    reader.skipType(tag & 7);
                                    break;
                                }
                            }
                            return message;
                        };

                        /**
                         * Decodes a CaseType message from the specified reader or buffer, length delimited.
                         * @function decodeDelimited
                         * @memberof scala.meta.internal.semanticdb.MatchType.CaseType
                         * @static
                         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                         * @returns {scala.meta.internal.semanticdb.MatchType.CaseType} CaseType
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        CaseType.decodeDelimited = function decodeDelimited(reader) {
                            if (!(reader instanceof $Reader))
                                reader = new $Reader(reader);
                            return this.decode(reader, reader.uint32());
                        };

                        /**
                         * Verifies a CaseType message.
                         * @function verify
                         * @memberof scala.meta.internal.semanticdb.MatchType.CaseType
                         * @static
                         * @param {Object.<string,*>} message Plain object to verify
                         * @returns {string|null} `null` if valid, otherwise the reason why it is not
                         */
                        CaseType.verify = function verify(message) {
                            if (typeof message !== "object" || message === null)
                                return "object expected";
                            if (message.key != null && message.hasOwnProperty("key")) {
                                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.key);
                                if (error)
                                    return "key." + error;
                            }
                            if (message.body != null && message.hasOwnProperty("body")) {
                                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.body);
                                if (error)
                                    return "body." + error;
                            }
                            return null;
                        };

                        /**
                         * Creates a CaseType message from a plain object. Also converts values to their respective internal types.
                         * @function fromObject
                         * @memberof scala.meta.internal.semanticdb.MatchType.CaseType
                         * @static
                         * @param {Object.<string,*>} object Plain object
                         * @returns {scala.meta.internal.semanticdb.MatchType.CaseType} CaseType
                         */
                        CaseType.fromObject = function fromObject(object) {
                            if (object instanceof $root.scala.meta.internal.semanticdb.MatchType.CaseType)
                                return object;
                            let message = new $root.scala.meta.internal.semanticdb.MatchType.CaseType();
                            if (object.key != null) {
                                if (typeof object.key !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.MatchType.CaseType.key: object expected");
                                message.key = $root.scala.meta.internal.semanticdb.Type.fromObject(object.key);
                            }
                            if (object.body != null) {
                                if (typeof object.body !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.MatchType.CaseType.body: object expected");
                                message.body = $root.scala.meta.internal.semanticdb.Type.fromObject(object.body);
                            }
                            return message;
                        };

                        /**
                         * Creates a plain object from a CaseType message. Also converts values to other types if specified.
                         * @function toObject
                         * @memberof scala.meta.internal.semanticdb.MatchType.CaseType
                         * @static
                         * @param {scala.meta.internal.semanticdb.MatchType.CaseType} message CaseType
                         * @param {$protobuf.IConversionOptions} [options] Conversion options
                         * @returns {Object.<string,*>} Plain object
                         */
                        CaseType.toObject = function toObject(message, options) {
                            if (!options)
                                options = {};
                            let object = {};
                            if (options.defaults) {
                                object.key = null;
                                object.body = null;
                            }
                            if (message.key != null && message.hasOwnProperty("key"))
                                object.key = $root.scala.meta.internal.semanticdb.Type.toObject(message.key, options);
                            if (message.body != null && message.hasOwnProperty("body"))
                                object.body = $root.scala.meta.internal.semanticdb.Type.toObject(message.body, options);
                            return object;
                        };

                        /**
                         * Converts this CaseType to JSON.
                         * @function toJSON
                         * @memberof scala.meta.internal.semanticdb.MatchType.CaseType
                         * @instance
                         * @returns {Object.<string,*>} JSON object
                         */
                        CaseType.prototype.toJSON = function toJSON() {
                            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                        };

                        /**
                         * Gets the default type url for CaseType
                         * @function getTypeUrl
                         * @memberof scala.meta.internal.semanticdb.MatchType.CaseType
                         * @static
                         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns {string} The default type url
                         */
                        CaseType.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                            if (typeUrlPrefix === undefined) {
                                typeUrlPrefix = "type.googleapis.com";
                            }
                            return typeUrlPrefix + "/scala.meta.internal.semanticdb.MatchType.CaseType";
                        };

                        return CaseType;
                    })();

                    return MatchType;
                })();

                semanticdb.Constant = (function() {

                    /**
                     * Properties of a Constant.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IConstant
                     * @property {scala.meta.internal.semanticdb.IUnitConstant|null} [unitConstant] Constant unitConstant
                     * @property {scala.meta.internal.semanticdb.IBooleanConstant|null} [booleanConstant] Constant booleanConstant
                     * @property {scala.meta.internal.semanticdb.IByteConstant|null} [byteConstant] Constant byteConstant
                     * @property {scala.meta.internal.semanticdb.IShortConstant|null} [shortConstant] Constant shortConstant
                     * @property {scala.meta.internal.semanticdb.ICharConstant|null} [charConstant] Constant charConstant
                     * @property {scala.meta.internal.semanticdb.IIntConstant|null} [intConstant] Constant intConstant
                     * @property {scala.meta.internal.semanticdb.ILongConstant|null} [longConstant] Constant longConstant
                     * @property {scala.meta.internal.semanticdb.IFloatConstant|null} [floatConstant] Constant floatConstant
                     * @property {scala.meta.internal.semanticdb.IDoubleConstant|null} [doubleConstant] Constant doubleConstant
                     * @property {scala.meta.internal.semanticdb.IStringConstant|null} [stringConstant] Constant stringConstant
                     * @property {scala.meta.internal.semanticdb.INullConstant|null} [nullConstant] Constant nullConstant
                     */

                    /**
                     * Constructs a new Constant.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a Constant.
                     * @implements IConstant
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IConstant=} [properties] Properties to set
                     */
                    function Constant(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Constant unitConstant.
                     * @member {scala.meta.internal.semanticdb.IUnitConstant|null|undefined} unitConstant
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     */
                    Constant.prototype.unitConstant = null;

                    /**
                     * Constant booleanConstant.
                     * @member {scala.meta.internal.semanticdb.IBooleanConstant|null|undefined} booleanConstant
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     */
                    Constant.prototype.booleanConstant = null;

                    /**
                     * Constant byteConstant.
                     * @member {scala.meta.internal.semanticdb.IByteConstant|null|undefined} byteConstant
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     */
                    Constant.prototype.byteConstant = null;

                    /**
                     * Constant shortConstant.
                     * @member {scala.meta.internal.semanticdb.IShortConstant|null|undefined} shortConstant
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     */
                    Constant.prototype.shortConstant = null;

                    /**
                     * Constant charConstant.
                     * @member {scala.meta.internal.semanticdb.ICharConstant|null|undefined} charConstant
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     */
                    Constant.prototype.charConstant = null;

                    /**
                     * Constant intConstant.
                     * @member {scala.meta.internal.semanticdb.IIntConstant|null|undefined} intConstant
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     */
                    Constant.prototype.intConstant = null;

                    /**
                     * Constant longConstant.
                     * @member {scala.meta.internal.semanticdb.ILongConstant|null|undefined} longConstant
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     */
                    Constant.prototype.longConstant = null;

                    /**
                     * Constant floatConstant.
                     * @member {scala.meta.internal.semanticdb.IFloatConstant|null|undefined} floatConstant
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     */
                    Constant.prototype.floatConstant = null;

                    /**
                     * Constant doubleConstant.
                     * @member {scala.meta.internal.semanticdb.IDoubleConstant|null|undefined} doubleConstant
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     */
                    Constant.prototype.doubleConstant = null;

                    /**
                     * Constant stringConstant.
                     * @member {scala.meta.internal.semanticdb.IStringConstant|null|undefined} stringConstant
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     */
                    Constant.prototype.stringConstant = null;

                    /**
                     * Constant nullConstant.
                     * @member {scala.meta.internal.semanticdb.INullConstant|null|undefined} nullConstant
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     */
                    Constant.prototype.nullConstant = null;

                    // OneOf field names bound to virtual getters and setters
                    let $oneOfFields;

                    /**
                     * Constant sealedValue.
                     * @member {"unitConstant"|"booleanConstant"|"byteConstant"|"shortConstant"|"charConstant"|"intConstant"|"longConstant"|"floatConstant"|"doubleConstant"|"stringConstant"|"nullConstant"|undefined} sealedValue
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     */
                    Object.defineProperty(Constant.prototype, "sealedValue", {
                        get: $util.oneOfGetter($oneOfFields = ["unitConstant", "booleanConstant", "byteConstant", "shortConstant", "charConstant", "intConstant", "longConstant", "floatConstant", "doubleConstant", "stringConstant", "nullConstant"]),
                        set: $util.oneOfSetter($oneOfFields)
                    });

                    /**
                     * Creates a new Constant instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IConstant=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.Constant} Constant instance
                     */
                    Constant.create = function create(properties) {
                        return new Constant(properties);
                    };

                    /**
                     * Encodes the specified Constant message. Does not implicitly {@link scala.meta.internal.semanticdb.Constant.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IConstant} message Constant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Constant.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.unitConstant != null && Object.hasOwnProperty.call(message, "unitConstant"))
                            $root.scala.meta.internal.semanticdb.UnitConstant.encode(message.unitConstant, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.booleanConstant != null && Object.hasOwnProperty.call(message, "booleanConstant"))
                            $root.scala.meta.internal.semanticdb.BooleanConstant.encode(message.booleanConstant, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.byteConstant != null && Object.hasOwnProperty.call(message, "byteConstant"))
                            $root.scala.meta.internal.semanticdb.ByteConstant.encode(message.byteConstant, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        if (message.shortConstant != null && Object.hasOwnProperty.call(message, "shortConstant"))
                            $root.scala.meta.internal.semanticdb.ShortConstant.encode(message.shortConstant, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
                        if (message.charConstant != null && Object.hasOwnProperty.call(message, "charConstant"))
                            $root.scala.meta.internal.semanticdb.CharConstant.encode(message.charConstant, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
                        if (message.intConstant != null && Object.hasOwnProperty.call(message, "intConstant"))
                            $root.scala.meta.internal.semanticdb.IntConstant.encode(message.intConstant, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
                        if (message.longConstant != null && Object.hasOwnProperty.call(message, "longConstant"))
                            $root.scala.meta.internal.semanticdb.LongConstant.encode(message.longConstant, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
                        if (message.floatConstant != null && Object.hasOwnProperty.call(message, "floatConstant"))
                            $root.scala.meta.internal.semanticdb.FloatConstant.encode(message.floatConstant, writer.uint32(/* id 8, wireType 2 =*/66).fork()).ldelim();
                        if (message.doubleConstant != null && Object.hasOwnProperty.call(message, "doubleConstant"))
                            $root.scala.meta.internal.semanticdb.DoubleConstant.encode(message.doubleConstant, writer.uint32(/* id 9, wireType 2 =*/74).fork()).ldelim();
                        if (message.stringConstant != null && Object.hasOwnProperty.call(message, "stringConstant"))
                            $root.scala.meta.internal.semanticdb.StringConstant.encode(message.stringConstant, writer.uint32(/* id 10, wireType 2 =*/82).fork()).ldelim();
                        if (message.nullConstant != null && Object.hasOwnProperty.call(message, "nullConstant"))
                            $root.scala.meta.internal.semanticdb.NullConstant.encode(message.nullConstant, writer.uint32(/* id 11, wireType 2 =*/90).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified Constant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Constant.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IConstant} message Constant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Constant.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Constant message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.Constant} Constant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Constant.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Constant();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.unitConstant = $root.scala.meta.internal.semanticdb.UnitConstant.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.booleanConstant = $root.scala.meta.internal.semanticdb.BooleanConstant.decode(reader, reader.uint32());
                                    break;
                                }
                            case 3: {
                                    message.byteConstant = $root.scala.meta.internal.semanticdb.ByteConstant.decode(reader, reader.uint32());
                                    break;
                                }
                            case 4: {
                                    message.shortConstant = $root.scala.meta.internal.semanticdb.ShortConstant.decode(reader, reader.uint32());
                                    break;
                                }
                            case 5: {
                                    message.charConstant = $root.scala.meta.internal.semanticdb.CharConstant.decode(reader, reader.uint32());
                                    break;
                                }
                            case 6: {
                                    message.intConstant = $root.scala.meta.internal.semanticdb.IntConstant.decode(reader, reader.uint32());
                                    break;
                                }
                            case 7: {
                                    message.longConstant = $root.scala.meta.internal.semanticdb.LongConstant.decode(reader, reader.uint32());
                                    break;
                                }
                            case 8: {
                                    message.floatConstant = $root.scala.meta.internal.semanticdb.FloatConstant.decode(reader, reader.uint32());
                                    break;
                                }
                            case 9: {
                                    message.doubleConstant = $root.scala.meta.internal.semanticdb.DoubleConstant.decode(reader, reader.uint32());
                                    break;
                                }
                            case 10: {
                                    message.stringConstant = $root.scala.meta.internal.semanticdb.StringConstant.decode(reader, reader.uint32());
                                    break;
                                }
                            case 11: {
                                    message.nullConstant = $root.scala.meta.internal.semanticdb.NullConstant.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Constant message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.Constant} Constant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Constant.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Constant message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Constant.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        let properties = {};
                        if (message.unitConstant != null && message.hasOwnProperty("unitConstant")) {
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.UnitConstant.verify(message.unitConstant);
                                if (error)
                                    return "unitConstant." + error;
                            }
                        }
                        if (message.booleanConstant != null && message.hasOwnProperty("booleanConstant")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.BooleanConstant.verify(message.booleanConstant);
                                if (error)
                                    return "booleanConstant." + error;
                            }
                        }
                        if (message.byteConstant != null && message.hasOwnProperty("byteConstant")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.ByteConstant.verify(message.byteConstant);
                                if (error)
                                    return "byteConstant." + error;
                            }
                        }
                        if (message.shortConstant != null && message.hasOwnProperty("shortConstant")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.ShortConstant.verify(message.shortConstant);
                                if (error)
                                    return "shortConstant." + error;
                            }
                        }
                        if (message.charConstant != null && message.hasOwnProperty("charConstant")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.CharConstant.verify(message.charConstant);
                                if (error)
                                    return "charConstant." + error;
                            }
                        }
                        if (message.intConstant != null && message.hasOwnProperty("intConstant")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.IntConstant.verify(message.intConstant);
                                if (error)
                                    return "intConstant." + error;
                            }
                        }
                        if (message.longConstant != null && message.hasOwnProperty("longConstant")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.LongConstant.verify(message.longConstant);
                                if (error)
                                    return "longConstant." + error;
                            }
                        }
                        if (message.floatConstant != null && message.hasOwnProperty("floatConstant")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.FloatConstant.verify(message.floatConstant);
                                if (error)
                                    return "floatConstant." + error;
                            }
                        }
                        if (message.doubleConstant != null && message.hasOwnProperty("doubleConstant")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.DoubleConstant.verify(message.doubleConstant);
                                if (error)
                                    return "doubleConstant." + error;
                            }
                        }
                        if (message.stringConstant != null && message.hasOwnProperty("stringConstant")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.StringConstant.verify(message.stringConstant);
                                if (error)
                                    return "stringConstant." + error;
                            }
                        }
                        if (message.nullConstant != null && message.hasOwnProperty("nullConstant")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.NullConstant.verify(message.nullConstant);
                                if (error)
                                    return "nullConstant." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates a Constant message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.Constant} Constant
                     */
                    Constant.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.Constant)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.Constant();
                        if (object.unitConstant != null) {
                            if (typeof object.unitConstant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Constant.unitConstant: object expected");
                            message.unitConstant = $root.scala.meta.internal.semanticdb.UnitConstant.fromObject(object.unitConstant);
                        }
                        if (object.booleanConstant != null) {
                            if (typeof object.booleanConstant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Constant.booleanConstant: object expected");
                            message.booleanConstant = $root.scala.meta.internal.semanticdb.BooleanConstant.fromObject(object.booleanConstant);
                        }
                        if (object.byteConstant != null) {
                            if (typeof object.byteConstant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Constant.byteConstant: object expected");
                            message.byteConstant = $root.scala.meta.internal.semanticdb.ByteConstant.fromObject(object.byteConstant);
                        }
                        if (object.shortConstant != null) {
                            if (typeof object.shortConstant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Constant.shortConstant: object expected");
                            message.shortConstant = $root.scala.meta.internal.semanticdb.ShortConstant.fromObject(object.shortConstant);
                        }
                        if (object.charConstant != null) {
                            if (typeof object.charConstant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Constant.charConstant: object expected");
                            message.charConstant = $root.scala.meta.internal.semanticdb.CharConstant.fromObject(object.charConstant);
                        }
                        if (object.intConstant != null) {
                            if (typeof object.intConstant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Constant.intConstant: object expected");
                            message.intConstant = $root.scala.meta.internal.semanticdb.IntConstant.fromObject(object.intConstant);
                        }
                        if (object.longConstant != null) {
                            if (typeof object.longConstant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Constant.longConstant: object expected");
                            message.longConstant = $root.scala.meta.internal.semanticdb.LongConstant.fromObject(object.longConstant);
                        }
                        if (object.floatConstant != null) {
                            if (typeof object.floatConstant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Constant.floatConstant: object expected");
                            message.floatConstant = $root.scala.meta.internal.semanticdb.FloatConstant.fromObject(object.floatConstant);
                        }
                        if (object.doubleConstant != null) {
                            if (typeof object.doubleConstant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Constant.doubleConstant: object expected");
                            message.doubleConstant = $root.scala.meta.internal.semanticdb.DoubleConstant.fromObject(object.doubleConstant);
                        }
                        if (object.stringConstant != null) {
                            if (typeof object.stringConstant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Constant.stringConstant: object expected");
                            message.stringConstant = $root.scala.meta.internal.semanticdb.StringConstant.fromObject(object.stringConstant);
                        }
                        if (object.nullConstant != null) {
                            if (typeof object.nullConstant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Constant.nullConstant: object expected");
                            message.nullConstant = $root.scala.meta.internal.semanticdb.NullConstant.fromObject(object.nullConstant);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a Constant message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @static
                     * @param {scala.meta.internal.semanticdb.Constant} message Constant
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Constant.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (message.unitConstant != null && message.hasOwnProperty("unitConstant")) {
                            object.unitConstant = $root.scala.meta.internal.semanticdb.UnitConstant.toObject(message.unitConstant, options);
                            if (options.oneofs)
                                object.sealedValue = "unitConstant";
                        }
                        if (message.booleanConstant != null && message.hasOwnProperty("booleanConstant")) {
                            object.booleanConstant = $root.scala.meta.internal.semanticdb.BooleanConstant.toObject(message.booleanConstant, options);
                            if (options.oneofs)
                                object.sealedValue = "booleanConstant";
                        }
                        if (message.byteConstant != null && message.hasOwnProperty("byteConstant")) {
                            object.byteConstant = $root.scala.meta.internal.semanticdb.ByteConstant.toObject(message.byteConstant, options);
                            if (options.oneofs)
                                object.sealedValue = "byteConstant";
                        }
                        if (message.shortConstant != null && message.hasOwnProperty("shortConstant")) {
                            object.shortConstant = $root.scala.meta.internal.semanticdb.ShortConstant.toObject(message.shortConstant, options);
                            if (options.oneofs)
                                object.sealedValue = "shortConstant";
                        }
                        if (message.charConstant != null && message.hasOwnProperty("charConstant")) {
                            object.charConstant = $root.scala.meta.internal.semanticdb.CharConstant.toObject(message.charConstant, options);
                            if (options.oneofs)
                                object.sealedValue = "charConstant";
                        }
                        if (message.intConstant != null && message.hasOwnProperty("intConstant")) {
                            object.intConstant = $root.scala.meta.internal.semanticdb.IntConstant.toObject(message.intConstant, options);
                            if (options.oneofs)
                                object.sealedValue = "intConstant";
                        }
                        if (message.longConstant != null && message.hasOwnProperty("longConstant")) {
                            object.longConstant = $root.scala.meta.internal.semanticdb.LongConstant.toObject(message.longConstant, options);
                            if (options.oneofs)
                                object.sealedValue = "longConstant";
                        }
                        if (message.floatConstant != null && message.hasOwnProperty("floatConstant")) {
                            object.floatConstant = $root.scala.meta.internal.semanticdb.FloatConstant.toObject(message.floatConstant, options);
                            if (options.oneofs)
                                object.sealedValue = "floatConstant";
                        }
                        if (message.doubleConstant != null && message.hasOwnProperty("doubleConstant")) {
                            object.doubleConstant = $root.scala.meta.internal.semanticdb.DoubleConstant.toObject(message.doubleConstant, options);
                            if (options.oneofs)
                                object.sealedValue = "doubleConstant";
                        }
                        if (message.stringConstant != null && message.hasOwnProperty("stringConstant")) {
                            object.stringConstant = $root.scala.meta.internal.semanticdb.StringConstant.toObject(message.stringConstant, options);
                            if (options.oneofs)
                                object.sealedValue = "stringConstant";
                        }
                        if (message.nullConstant != null && message.hasOwnProperty("nullConstant")) {
                            object.nullConstant = $root.scala.meta.internal.semanticdb.NullConstant.toObject(message.nullConstant, options);
                            if (options.oneofs)
                                object.sealedValue = "nullConstant";
                        }
                        return object;
                    };

                    /**
                     * Converts this Constant to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Constant.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Constant
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.Constant
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Constant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.Constant";
                    };

                    return Constant;
                })();

                semanticdb.UnitConstant = (function() {

                    /**
                     * Properties of an UnitConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IUnitConstant
                     */

                    /**
                     * Constructs a new UnitConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an UnitConstant.
                     * @implements IUnitConstant
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IUnitConstant=} [properties] Properties to set
                     */
                    function UnitConstant(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Creates a new UnitConstant instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.UnitConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IUnitConstant=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.UnitConstant} UnitConstant instance
                     */
                    UnitConstant.create = function create(properties) {
                        return new UnitConstant(properties);
                    };

                    /**
                     * Encodes the specified UnitConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.UnitConstant.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.UnitConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IUnitConstant} message UnitConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    UnitConstant.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        return writer;
                    };

                    /**
                     * Encodes the specified UnitConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.UnitConstant.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.UnitConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IUnitConstant} message UnitConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    UnitConstant.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an UnitConstant message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.UnitConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.UnitConstant} UnitConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    UnitConstant.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.UnitConstant();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an UnitConstant message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.UnitConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.UnitConstant} UnitConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    UnitConstant.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an UnitConstant message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.UnitConstant
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    UnitConstant.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        return null;
                    };

                    /**
                     * Creates an UnitConstant message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.UnitConstant
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.UnitConstant} UnitConstant
                     */
                    UnitConstant.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.UnitConstant)
                            return object;
                        return new $root.scala.meta.internal.semanticdb.UnitConstant();
                    };

                    /**
                     * Creates a plain object from an UnitConstant message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.UnitConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.UnitConstant} message UnitConstant
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    UnitConstant.toObject = function toObject() {
                        return {};
                    };

                    /**
                     * Converts this UnitConstant to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.UnitConstant
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    UnitConstant.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for UnitConstant
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.UnitConstant
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    UnitConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.UnitConstant";
                    };

                    return UnitConstant;
                })();

                semanticdb.BooleanConstant = (function() {

                    /**
                     * Properties of a BooleanConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IBooleanConstant
                     * @property {boolean|null} [value] BooleanConstant value
                     */

                    /**
                     * Constructs a new BooleanConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a BooleanConstant.
                     * @implements IBooleanConstant
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IBooleanConstant=} [properties] Properties to set
                     */
                    function BooleanConstant(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * BooleanConstant value.
                     * @member {boolean} value
                     * @memberof scala.meta.internal.semanticdb.BooleanConstant
                     * @instance
                     */
                    BooleanConstant.prototype.value = false;

                    /**
                     * Creates a new BooleanConstant instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.BooleanConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IBooleanConstant=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.BooleanConstant} BooleanConstant instance
                     */
                    BooleanConstant.create = function create(properties) {
                        return new BooleanConstant(properties);
                    };

                    /**
                     * Encodes the specified BooleanConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.BooleanConstant.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.BooleanConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IBooleanConstant} message BooleanConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    BooleanConstant.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                            writer.uint32(/* id 1, wireType 0 =*/8).bool(message.value);
                        return writer;
                    };

                    /**
                     * Encodes the specified BooleanConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.BooleanConstant.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.BooleanConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IBooleanConstant} message BooleanConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    BooleanConstant.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a BooleanConstant message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.BooleanConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.BooleanConstant} BooleanConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    BooleanConstant.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.BooleanConstant();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.value = reader.bool();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a BooleanConstant message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.BooleanConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.BooleanConstant} BooleanConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    BooleanConstant.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a BooleanConstant message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.BooleanConstant
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    BooleanConstant.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.value != null && message.hasOwnProperty("value"))
                            if (typeof message.value !== "boolean")
                                return "value: boolean expected";
                        return null;
                    };

                    /**
                     * Creates a BooleanConstant message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.BooleanConstant
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.BooleanConstant} BooleanConstant
                     */
                    BooleanConstant.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.BooleanConstant)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.BooleanConstant();
                        if (object.value != null)
                            message.value = Boolean(object.value);
                        return message;
                    };

                    /**
                     * Creates a plain object from a BooleanConstant message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.BooleanConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.BooleanConstant} message BooleanConstant
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    BooleanConstant.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.value = false;
                        if (message.value != null && message.hasOwnProperty("value"))
                            object.value = message.value;
                        return object;
                    };

                    /**
                     * Converts this BooleanConstant to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.BooleanConstant
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    BooleanConstant.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for BooleanConstant
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.BooleanConstant
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    BooleanConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.BooleanConstant";
                    };

                    return BooleanConstant;
                })();

                semanticdb.ByteConstant = (function() {

                    /**
                     * Properties of a ByteConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IByteConstant
                     * @property {number|null} [value] ByteConstant value
                     */

                    /**
                     * Constructs a new ByteConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a ByteConstant.
                     * @implements IByteConstant
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IByteConstant=} [properties] Properties to set
                     */
                    function ByteConstant(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ByteConstant value.
                     * @member {number} value
                     * @memberof scala.meta.internal.semanticdb.ByteConstant
                     * @instance
                     */
                    ByteConstant.prototype.value = 0;

                    /**
                     * Creates a new ByteConstant instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.ByteConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IByteConstant=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.ByteConstant} ByteConstant instance
                     */
                    ByteConstant.create = function create(properties) {
                        return new ByteConstant(properties);
                    };

                    /**
                     * Encodes the specified ByteConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.ByteConstant.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.ByteConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IByteConstant} message ByteConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ByteConstant.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.value);
                        return writer;
                    };

                    /**
                     * Encodes the specified ByteConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ByteConstant.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ByteConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IByteConstant} message ByteConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ByteConstant.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ByteConstant message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.ByteConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.ByteConstant} ByteConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ByteConstant.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ByteConstant();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.value = reader.int32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ByteConstant message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ByteConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.ByteConstant} ByteConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ByteConstant.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ByteConstant message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.ByteConstant
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ByteConstant.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.value != null && message.hasOwnProperty("value"))
                            if (!$util.isInteger(message.value))
                                return "value: integer expected";
                        return null;
                    };

                    /**
                     * Creates a ByteConstant message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.ByteConstant
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.ByteConstant} ByteConstant
                     */
                    ByteConstant.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.ByteConstant)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.ByteConstant();
                        if (object.value != null)
                            message.value = object.value | 0;
                        return message;
                    };

                    /**
                     * Creates a plain object from a ByteConstant message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.ByteConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.ByteConstant} message ByteConstant
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ByteConstant.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.value = 0;
                        if (message.value != null && message.hasOwnProperty("value"))
                            object.value = message.value;
                        return object;
                    };

                    /**
                     * Converts this ByteConstant to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.ByteConstant
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ByteConstant.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ByteConstant
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.ByteConstant
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ByteConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.ByteConstant";
                    };

                    return ByteConstant;
                })();

                semanticdb.ShortConstant = (function() {

                    /**
                     * Properties of a ShortConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IShortConstant
                     * @property {number|null} [value] ShortConstant value
                     */

                    /**
                     * Constructs a new ShortConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a ShortConstant.
                     * @implements IShortConstant
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IShortConstant=} [properties] Properties to set
                     */
                    function ShortConstant(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ShortConstant value.
                     * @member {number} value
                     * @memberof scala.meta.internal.semanticdb.ShortConstant
                     * @instance
                     */
                    ShortConstant.prototype.value = 0;

                    /**
                     * Creates a new ShortConstant instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.ShortConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IShortConstant=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.ShortConstant} ShortConstant instance
                     */
                    ShortConstant.create = function create(properties) {
                        return new ShortConstant(properties);
                    };

                    /**
                     * Encodes the specified ShortConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.ShortConstant.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.ShortConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IShortConstant} message ShortConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ShortConstant.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.value);
                        return writer;
                    };

                    /**
                     * Encodes the specified ShortConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ShortConstant.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ShortConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IShortConstant} message ShortConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ShortConstant.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ShortConstant message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.ShortConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.ShortConstant} ShortConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ShortConstant.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ShortConstant();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.value = reader.int32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ShortConstant message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ShortConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.ShortConstant} ShortConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ShortConstant.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ShortConstant message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.ShortConstant
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ShortConstant.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.value != null && message.hasOwnProperty("value"))
                            if (!$util.isInteger(message.value))
                                return "value: integer expected";
                        return null;
                    };

                    /**
                     * Creates a ShortConstant message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.ShortConstant
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.ShortConstant} ShortConstant
                     */
                    ShortConstant.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.ShortConstant)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.ShortConstant();
                        if (object.value != null)
                            message.value = object.value | 0;
                        return message;
                    };

                    /**
                     * Creates a plain object from a ShortConstant message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.ShortConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.ShortConstant} message ShortConstant
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ShortConstant.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.value = 0;
                        if (message.value != null && message.hasOwnProperty("value"))
                            object.value = message.value;
                        return object;
                    };

                    /**
                     * Converts this ShortConstant to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.ShortConstant
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ShortConstant.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ShortConstant
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.ShortConstant
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ShortConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.ShortConstant";
                    };

                    return ShortConstant;
                })();

                semanticdb.CharConstant = (function() {

                    /**
                     * Properties of a CharConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ICharConstant
                     * @property {number|null} [value] CharConstant value
                     */

                    /**
                     * Constructs a new CharConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a CharConstant.
                     * @implements ICharConstant
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ICharConstant=} [properties] Properties to set
                     */
                    function CharConstant(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * CharConstant value.
                     * @member {number} value
                     * @memberof scala.meta.internal.semanticdb.CharConstant
                     * @instance
                     */
                    CharConstant.prototype.value = 0;

                    /**
                     * Creates a new CharConstant instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.CharConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.ICharConstant=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.CharConstant} CharConstant instance
                     */
                    CharConstant.create = function create(properties) {
                        return new CharConstant(properties);
                    };

                    /**
                     * Encodes the specified CharConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.CharConstant.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.CharConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.ICharConstant} message CharConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    CharConstant.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.value);
                        return writer;
                    };

                    /**
                     * Encodes the specified CharConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.CharConstant.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.CharConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.ICharConstant} message CharConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    CharConstant.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a CharConstant message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.CharConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.CharConstant} CharConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    CharConstant.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.CharConstant();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.value = reader.int32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a CharConstant message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.CharConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.CharConstant} CharConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    CharConstant.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a CharConstant message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.CharConstant
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    CharConstant.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.value != null && message.hasOwnProperty("value"))
                            if (!$util.isInteger(message.value))
                                return "value: integer expected";
                        return null;
                    };

                    /**
                     * Creates a CharConstant message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.CharConstant
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.CharConstant} CharConstant
                     */
                    CharConstant.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.CharConstant)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.CharConstant();
                        if (object.value != null)
                            message.value = object.value | 0;
                        return message;
                    };

                    /**
                     * Creates a plain object from a CharConstant message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.CharConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.CharConstant} message CharConstant
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    CharConstant.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.value = 0;
                        if (message.value != null && message.hasOwnProperty("value"))
                            object.value = message.value;
                        return object;
                    };

                    /**
                     * Converts this CharConstant to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.CharConstant
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    CharConstant.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for CharConstant
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.CharConstant
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    CharConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.CharConstant";
                    };

                    return CharConstant;
                })();

                semanticdb.IntConstant = (function() {

                    /**
                     * Properties of an IntConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IIntConstant
                     * @property {number|null} [value] IntConstant value
                     */

                    /**
                     * Constructs a new IntConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an IntConstant.
                     * @implements IIntConstant
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IIntConstant=} [properties] Properties to set
                     */
                    function IntConstant(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * IntConstant value.
                     * @member {number} value
                     * @memberof scala.meta.internal.semanticdb.IntConstant
                     * @instance
                     */
                    IntConstant.prototype.value = 0;

                    /**
                     * Creates a new IntConstant instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.IntConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IIntConstant=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.IntConstant} IntConstant instance
                     */
                    IntConstant.create = function create(properties) {
                        return new IntConstant(properties);
                    };

                    /**
                     * Encodes the specified IntConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.IntConstant.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.IntConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IIntConstant} message IntConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    IntConstant.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.value);
                        return writer;
                    };

                    /**
                     * Encodes the specified IntConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.IntConstant.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.IntConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IIntConstant} message IntConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    IntConstant.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an IntConstant message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.IntConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.IntConstant} IntConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    IntConstant.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.IntConstant();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.value = reader.int32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an IntConstant message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.IntConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.IntConstant} IntConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    IntConstant.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an IntConstant message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.IntConstant
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    IntConstant.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.value != null && message.hasOwnProperty("value"))
                            if (!$util.isInteger(message.value))
                                return "value: integer expected";
                        return null;
                    };

                    /**
                     * Creates an IntConstant message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.IntConstant
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.IntConstant} IntConstant
                     */
                    IntConstant.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.IntConstant)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.IntConstant();
                        if (object.value != null)
                            message.value = object.value | 0;
                        return message;
                    };

                    /**
                     * Creates a plain object from an IntConstant message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.IntConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IntConstant} message IntConstant
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    IntConstant.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.value = 0;
                        if (message.value != null && message.hasOwnProperty("value"))
                            object.value = message.value;
                        return object;
                    };

                    /**
                     * Converts this IntConstant to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.IntConstant
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    IntConstant.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for IntConstant
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.IntConstant
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    IntConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.IntConstant";
                    };

                    return IntConstant;
                })();

                semanticdb.LongConstant = (function() {

                    /**
                     * Properties of a LongConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ILongConstant
                     * @property {number|Long|null} [value] LongConstant value
                     */

                    /**
                     * Constructs a new LongConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a LongConstant.
                     * @implements ILongConstant
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ILongConstant=} [properties] Properties to set
                     */
                    function LongConstant(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * LongConstant value.
                     * @member {number|Long} value
                     * @memberof scala.meta.internal.semanticdb.LongConstant
                     * @instance
                     */
                    LongConstant.prototype.value = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

                    /**
                     * Creates a new LongConstant instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.LongConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.ILongConstant=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.LongConstant} LongConstant instance
                     */
                    LongConstant.create = function create(properties) {
                        return new LongConstant(properties);
                    };

                    /**
                     * Encodes the specified LongConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.LongConstant.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.LongConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.ILongConstant} message LongConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    LongConstant.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                            writer.uint32(/* id 1, wireType 0 =*/8).int64(message.value);
                        return writer;
                    };

                    /**
                     * Encodes the specified LongConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.LongConstant.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.LongConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.ILongConstant} message LongConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    LongConstant.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a LongConstant message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.LongConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.LongConstant} LongConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    LongConstant.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.LongConstant();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.value = reader.int64();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a LongConstant message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.LongConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.LongConstant} LongConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    LongConstant.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a LongConstant message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.LongConstant
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    LongConstant.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.value != null && message.hasOwnProperty("value"))
                            if (!$util.isInteger(message.value) && !(message.value && $util.isInteger(message.value.low) && $util.isInteger(message.value.high)))
                                return "value: integer|Long expected";
                        return null;
                    };

                    /**
                     * Creates a LongConstant message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.LongConstant
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.LongConstant} LongConstant
                     */
                    LongConstant.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.LongConstant)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.LongConstant();
                        if (object.value != null)
                            if ($util.Long)
                                (message.value = $util.Long.fromValue(object.value)).unsigned = false;
                            else if (typeof object.value === "string")
                                message.value = parseInt(object.value, 10);
                            else if (typeof object.value === "number")
                                message.value = object.value;
                            else if (typeof object.value === "object")
                                message.value = new $util.LongBits(object.value.low >>> 0, object.value.high >>> 0).toNumber();
                        return message;
                    };

                    /**
                     * Creates a plain object from a LongConstant message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.LongConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.LongConstant} message LongConstant
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    LongConstant.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            if ($util.Long) {
                                let long = new $util.Long(0, 0, false);
                                object.value = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                            } else
                                object.value = options.longs === String ? "0" : 0;
                        if (message.value != null && message.hasOwnProperty("value"))
                            if (typeof message.value === "number")
                                object.value = options.longs === String ? String(message.value) : message.value;
                            else
                                object.value = options.longs === String ? $util.Long.prototype.toString.call(message.value) : options.longs === Number ? new $util.LongBits(message.value.low >>> 0, message.value.high >>> 0).toNumber() : message.value;
                        return object;
                    };

                    /**
                     * Converts this LongConstant to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.LongConstant
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    LongConstant.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for LongConstant
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.LongConstant
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    LongConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.LongConstant";
                    };

                    return LongConstant;
                })();

                semanticdb.FloatConstant = (function() {

                    /**
                     * Properties of a FloatConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IFloatConstant
                     * @property {number|null} [value] FloatConstant value
                     */

                    /**
                     * Constructs a new FloatConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a FloatConstant.
                     * @implements IFloatConstant
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IFloatConstant=} [properties] Properties to set
                     */
                    function FloatConstant(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * FloatConstant value.
                     * @member {number} value
                     * @memberof scala.meta.internal.semanticdb.FloatConstant
                     * @instance
                     */
                    FloatConstant.prototype.value = 0;

                    /**
                     * Creates a new FloatConstant instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.FloatConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IFloatConstant=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.FloatConstant} FloatConstant instance
                     */
                    FloatConstant.create = function create(properties) {
                        return new FloatConstant(properties);
                    };

                    /**
                     * Encodes the specified FloatConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.FloatConstant.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.FloatConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IFloatConstant} message FloatConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FloatConstant.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                            writer.uint32(/* id 1, wireType 5 =*/13).float(message.value);
                        return writer;
                    };

                    /**
                     * Encodes the specified FloatConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.FloatConstant.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.FloatConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IFloatConstant} message FloatConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FloatConstant.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a FloatConstant message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.FloatConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.FloatConstant} FloatConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FloatConstant.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.FloatConstant();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.value = reader.float();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a FloatConstant message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.FloatConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.FloatConstant} FloatConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FloatConstant.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a FloatConstant message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.FloatConstant
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    FloatConstant.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.value != null && message.hasOwnProperty("value"))
                            if (typeof message.value !== "number")
                                return "value: number expected";
                        return null;
                    };

                    /**
                     * Creates a FloatConstant message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.FloatConstant
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.FloatConstant} FloatConstant
                     */
                    FloatConstant.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.FloatConstant)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.FloatConstant();
                        if (object.value != null)
                            message.value = Number(object.value);
                        return message;
                    };

                    /**
                     * Creates a plain object from a FloatConstant message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.FloatConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.FloatConstant} message FloatConstant
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    FloatConstant.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.value = 0;
                        if (message.value != null && message.hasOwnProperty("value"))
                            object.value = options.json && !isFinite(message.value) ? String(message.value) : message.value;
                        return object;
                    };

                    /**
                     * Converts this FloatConstant to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.FloatConstant
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    FloatConstant.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for FloatConstant
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.FloatConstant
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    FloatConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.FloatConstant";
                    };

                    return FloatConstant;
                })();

                semanticdb.DoubleConstant = (function() {

                    /**
                     * Properties of a DoubleConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IDoubleConstant
                     * @property {number|null} [value] DoubleConstant value
                     */

                    /**
                     * Constructs a new DoubleConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a DoubleConstant.
                     * @implements IDoubleConstant
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IDoubleConstant=} [properties] Properties to set
                     */
                    function DoubleConstant(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * DoubleConstant value.
                     * @member {number} value
                     * @memberof scala.meta.internal.semanticdb.DoubleConstant
                     * @instance
                     */
                    DoubleConstant.prototype.value = 0;

                    /**
                     * Creates a new DoubleConstant instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.DoubleConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IDoubleConstant=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.DoubleConstant} DoubleConstant instance
                     */
                    DoubleConstant.create = function create(properties) {
                        return new DoubleConstant(properties);
                    };

                    /**
                     * Encodes the specified DoubleConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.DoubleConstant.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.DoubleConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IDoubleConstant} message DoubleConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    DoubleConstant.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                            writer.uint32(/* id 1, wireType 1 =*/9).double(message.value);
                        return writer;
                    };

                    /**
                     * Encodes the specified DoubleConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.DoubleConstant.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.DoubleConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IDoubleConstant} message DoubleConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    DoubleConstant.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a DoubleConstant message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.DoubleConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.DoubleConstant} DoubleConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    DoubleConstant.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.DoubleConstant();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.value = reader.double();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a DoubleConstant message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.DoubleConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.DoubleConstant} DoubleConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    DoubleConstant.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a DoubleConstant message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.DoubleConstant
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    DoubleConstant.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.value != null && message.hasOwnProperty("value"))
                            if (typeof message.value !== "number")
                                return "value: number expected";
                        return null;
                    };

                    /**
                     * Creates a DoubleConstant message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.DoubleConstant
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.DoubleConstant} DoubleConstant
                     */
                    DoubleConstant.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.DoubleConstant)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.DoubleConstant();
                        if (object.value != null)
                            message.value = Number(object.value);
                        return message;
                    };

                    /**
                     * Creates a plain object from a DoubleConstant message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.DoubleConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.DoubleConstant} message DoubleConstant
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    DoubleConstant.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.value = 0;
                        if (message.value != null && message.hasOwnProperty("value"))
                            object.value = options.json && !isFinite(message.value) ? String(message.value) : message.value;
                        return object;
                    };

                    /**
                     * Converts this DoubleConstant to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.DoubleConstant
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    DoubleConstant.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for DoubleConstant
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.DoubleConstant
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    DoubleConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.DoubleConstant";
                    };

                    return DoubleConstant;
                })();

                semanticdb.StringConstant = (function() {

                    /**
                     * Properties of a StringConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IStringConstant
                     * @property {string|null} [value] StringConstant value
                     */

                    /**
                     * Constructs a new StringConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a StringConstant.
                     * @implements IStringConstant
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IStringConstant=} [properties] Properties to set
                     */
                    function StringConstant(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * StringConstant value.
                     * @member {string} value
                     * @memberof scala.meta.internal.semanticdb.StringConstant
                     * @instance
                     */
                    StringConstant.prototype.value = "";

                    /**
                     * Creates a new StringConstant instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.StringConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IStringConstant=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.StringConstant} StringConstant instance
                     */
                    StringConstant.create = function create(properties) {
                        return new StringConstant(properties);
                    };

                    /**
                     * Encodes the specified StringConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.StringConstant.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.StringConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IStringConstant} message StringConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    StringConstant.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.value);
                        return writer;
                    };

                    /**
                     * Encodes the specified StringConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.StringConstant.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.StringConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.IStringConstant} message StringConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    StringConstant.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a StringConstant message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.StringConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.StringConstant} StringConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    StringConstant.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.StringConstant();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.value = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a StringConstant message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.StringConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.StringConstant} StringConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    StringConstant.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a StringConstant message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.StringConstant
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    StringConstant.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.value != null && message.hasOwnProperty("value"))
                            if (!$util.isString(message.value))
                                return "value: string expected";
                        return null;
                    };

                    /**
                     * Creates a StringConstant message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.StringConstant
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.StringConstant} StringConstant
                     */
                    StringConstant.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.StringConstant)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.StringConstant();
                        if (object.value != null)
                            message.value = String(object.value);
                        return message;
                    };

                    /**
                     * Creates a plain object from a StringConstant message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.StringConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.StringConstant} message StringConstant
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    StringConstant.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.value = "";
                        if (message.value != null && message.hasOwnProperty("value"))
                            object.value = message.value;
                        return object;
                    };

                    /**
                     * Converts this StringConstant to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.StringConstant
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    StringConstant.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for StringConstant
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.StringConstant
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    StringConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.StringConstant";
                    };

                    return StringConstant;
                })();

                semanticdb.NullConstant = (function() {

                    /**
                     * Properties of a NullConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface INullConstant
                     */

                    /**
                     * Constructs a new NullConstant.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a NullConstant.
                     * @implements INullConstant
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.INullConstant=} [properties] Properties to set
                     */
                    function NullConstant(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Creates a new NullConstant instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.NullConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.INullConstant=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.NullConstant} NullConstant instance
                     */
                    NullConstant.create = function create(properties) {
                        return new NullConstant(properties);
                    };

                    /**
                     * Encodes the specified NullConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.NullConstant.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.NullConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.INullConstant} message NullConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    NullConstant.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        return writer;
                    };

                    /**
                     * Encodes the specified NullConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.NullConstant.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.NullConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.INullConstant} message NullConstant message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    NullConstant.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a NullConstant message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.NullConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.NullConstant} NullConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    NullConstant.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.NullConstant();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a NullConstant message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.NullConstant
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.NullConstant} NullConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    NullConstant.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a NullConstant message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.NullConstant
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    NullConstant.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        return null;
                    };

                    /**
                     * Creates a NullConstant message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.NullConstant
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.NullConstant} NullConstant
                     */
                    NullConstant.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.NullConstant)
                            return object;
                        return new $root.scala.meta.internal.semanticdb.NullConstant();
                    };

                    /**
                     * Creates a plain object from a NullConstant message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.NullConstant
                     * @static
                     * @param {scala.meta.internal.semanticdb.NullConstant} message NullConstant
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    NullConstant.toObject = function toObject() {
                        return {};
                    };

                    /**
                     * Converts this NullConstant to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.NullConstant
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    NullConstant.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for NullConstant
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.NullConstant
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    NullConstant.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.NullConstant";
                    };

                    return NullConstant;
                })();

                semanticdb.Signature = (function() {

                    /**
                     * Properties of a Signature.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ISignature
                     * @property {scala.meta.internal.semanticdb.IClassSignature|null} [classSignature] Signature classSignature
                     * @property {scala.meta.internal.semanticdb.IMethodSignature|null} [methodSignature] Signature methodSignature
                     * @property {scala.meta.internal.semanticdb.ITypeSignature|null} [typeSignature] Signature typeSignature
                     * @property {scala.meta.internal.semanticdb.IValueSignature|null} [valueSignature] Signature valueSignature
                     */

                    /**
                     * Constructs a new Signature.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a Signature.
                     * @implements ISignature
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ISignature=} [properties] Properties to set
                     */
                    function Signature(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Signature classSignature.
                     * @member {scala.meta.internal.semanticdb.IClassSignature|null|undefined} classSignature
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @instance
                     */
                    Signature.prototype.classSignature = null;

                    /**
                     * Signature methodSignature.
                     * @member {scala.meta.internal.semanticdb.IMethodSignature|null|undefined} methodSignature
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @instance
                     */
                    Signature.prototype.methodSignature = null;

                    /**
                     * Signature typeSignature.
                     * @member {scala.meta.internal.semanticdb.ITypeSignature|null|undefined} typeSignature
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @instance
                     */
                    Signature.prototype.typeSignature = null;

                    /**
                     * Signature valueSignature.
                     * @member {scala.meta.internal.semanticdb.IValueSignature|null|undefined} valueSignature
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @instance
                     */
                    Signature.prototype.valueSignature = null;

                    // OneOf field names bound to virtual getters and setters
                    let $oneOfFields;

                    /**
                     * Signature sealedValue.
                     * @member {"classSignature"|"methodSignature"|"typeSignature"|"valueSignature"|undefined} sealedValue
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @instance
                     */
                    Object.defineProperty(Signature.prototype, "sealedValue", {
                        get: $util.oneOfGetter($oneOfFields = ["classSignature", "methodSignature", "typeSignature", "valueSignature"]),
                        set: $util.oneOfSetter($oneOfFields)
                    });

                    /**
                     * Creates a new Signature instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISignature=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.Signature} Signature instance
                     */
                    Signature.create = function create(properties) {
                        return new Signature(properties);
                    };

                    /**
                     * Encodes the specified Signature message. Does not implicitly {@link scala.meta.internal.semanticdb.Signature.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISignature} message Signature message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Signature.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.classSignature != null && Object.hasOwnProperty.call(message, "classSignature"))
                            $root.scala.meta.internal.semanticdb.ClassSignature.encode(message.classSignature, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.methodSignature != null && Object.hasOwnProperty.call(message, "methodSignature"))
                            $root.scala.meta.internal.semanticdb.MethodSignature.encode(message.methodSignature, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.typeSignature != null && Object.hasOwnProperty.call(message, "typeSignature"))
                            $root.scala.meta.internal.semanticdb.TypeSignature.encode(message.typeSignature, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        if (message.valueSignature != null && Object.hasOwnProperty.call(message, "valueSignature"))
                            $root.scala.meta.internal.semanticdb.ValueSignature.encode(message.valueSignature, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified Signature message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Signature.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISignature} message Signature message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Signature.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Signature message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.Signature} Signature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Signature.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Signature();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.classSignature = $root.scala.meta.internal.semanticdb.ClassSignature.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.methodSignature = $root.scala.meta.internal.semanticdb.MethodSignature.decode(reader, reader.uint32());
                                    break;
                                }
                            case 3: {
                                    message.typeSignature = $root.scala.meta.internal.semanticdb.TypeSignature.decode(reader, reader.uint32());
                                    break;
                                }
                            case 4: {
                                    message.valueSignature = $root.scala.meta.internal.semanticdb.ValueSignature.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Signature message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.Signature} Signature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Signature.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Signature message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Signature.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        let properties = {};
                        if (message.classSignature != null && message.hasOwnProperty("classSignature")) {
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.ClassSignature.verify(message.classSignature);
                                if (error)
                                    return "classSignature." + error;
                            }
                        }
                        if (message.methodSignature != null && message.hasOwnProperty("methodSignature")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.MethodSignature.verify(message.methodSignature);
                                if (error)
                                    return "methodSignature." + error;
                            }
                        }
                        if (message.typeSignature != null && message.hasOwnProperty("typeSignature")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.TypeSignature.verify(message.typeSignature);
                                if (error)
                                    return "typeSignature." + error;
                            }
                        }
                        if (message.valueSignature != null && message.hasOwnProperty("valueSignature")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.ValueSignature.verify(message.valueSignature);
                                if (error)
                                    return "valueSignature." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates a Signature message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.Signature} Signature
                     */
                    Signature.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.Signature)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.Signature();
                        if (object.classSignature != null) {
                            if (typeof object.classSignature !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Signature.classSignature: object expected");
                            message.classSignature = $root.scala.meta.internal.semanticdb.ClassSignature.fromObject(object.classSignature);
                        }
                        if (object.methodSignature != null) {
                            if (typeof object.methodSignature !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Signature.methodSignature: object expected");
                            message.methodSignature = $root.scala.meta.internal.semanticdb.MethodSignature.fromObject(object.methodSignature);
                        }
                        if (object.typeSignature != null) {
                            if (typeof object.typeSignature !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Signature.typeSignature: object expected");
                            message.typeSignature = $root.scala.meta.internal.semanticdb.TypeSignature.fromObject(object.typeSignature);
                        }
                        if (object.valueSignature != null) {
                            if (typeof object.valueSignature !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Signature.valueSignature: object expected");
                            message.valueSignature = $root.scala.meta.internal.semanticdb.ValueSignature.fromObject(object.valueSignature);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a Signature message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @static
                     * @param {scala.meta.internal.semanticdb.Signature} message Signature
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Signature.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (message.classSignature != null && message.hasOwnProperty("classSignature")) {
                            object.classSignature = $root.scala.meta.internal.semanticdb.ClassSignature.toObject(message.classSignature, options);
                            if (options.oneofs)
                                object.sealedValue = "classSignature";
                        }
                        if (message.methodSignature != null && message.hasOwnProperty("methodSignature")) {
                            object.methodSignature = $root.scala.meta.internal.semanticdb.MethodSignature.toObject(message.methodSignature, options);
                            if (options.oneofs)
                                object.sealedValue = "methodSignature";
                        }
                        if (message.typeSignature != null && message.hasOwnProperty("typeSignature")) {
                            object.typeSignature = $root.scala.meta.internal.semanticdb.TypeSignature.toObject(message.typeSignature, options);
                            if (options.oneofs)
                                object.sealedValue = "typeSignature";
                        }
                        if (message.valueSignature != null && message.hasOwnProperty("valueSignature")) {
                            object.valueSignature = $root.scala.meta.internal.semanticdb.ValueSignature.toObject(message.valueSignature, options);
                            if (options.oneofs)
                                object.sealedValue = "valueSignature";
                        }
                        return object;
                    };

                    /**
                     * Converts this Signature to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Signature.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Signature
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.Signature
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Signature.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.Signature";
                    };

                    return Signature;
                })();

                semanticdb.ClassSignature = (function() {

                    /**
                     * Properties of a ClassSignature.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IClassSignature
                     * @property {scala.meta.internal.semanticdb.IScope|null} [typeParameters] ClassSignature typeParameters
                     * @property {Array.<scala.meta.internal.semanticdb.IType>|null} [parents] ClassSignature parents
                     * @property {scala.meta.internal.semanticdb.IType|null} [self] ClassSignature self
                     * @property {scala.meta.internal.semanticdb.IScope|null} [declarations] ClassSignature declarations
                     */

                    /**
                     * Constructs a new ClassSignature.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a ClassSignature.
                     * @implements IClassSignature
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IClassSignature=} [properties] Properties to set
                     */
                    function ClassSignature(properties) {
                        this.parents = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ClassSignature typeParameters.
                     * @member {scala.meta.internal.semanticdb.IScope|null|undefined} typeParameters
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @instance
                     */
                    ClassSignature.prototype.typeParameters = null;

                    /**
                     * ClassSignature parents.
                     * @member {Array.<scala.meta.internal.semanticdb.IType>} parents
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @instance
                     */
                    ClassSignature.prototype.parents = $util.emptyArray;

                    /**
                     * ClassSignature self.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} self
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @instance
                     */
                    ClassSignature.prototype.self = null;

                    /**
                     * ClassSignature declarations.
                     * @member {scala.meta.internal.semanticdb.IScope|null|undefined} declarations
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @instance
                     */
                    ClassSignature.prototype.declarations = null;

                    /**
                     * Creates a new ClassSignature instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.IClassSignature=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.ClassSignature} ClassSignature instance
                     */
                    ClassSignature.create = function create(properties) {
                        return new ClassSignature(properties);
                    };

                    /**
                     * Encodes the specified ClassSignature message. Does not implicitly {@link scala.meta.internal.semanticdb.ClassSignature.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.IClassSignature} message ClassSignature message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ClassSignature.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.typeParameters != null && Object.hasOwnProperty.call(message, "typeParameters"))
                            $root.scala.meta.internal.semanticdb.Scope.encode(message.typeParameters, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.parents != null && message.parents.length)
                            for (let i = 0; i < message.parents.length; ++i)
                                $root.scala.meta.internal.semanticdb.Type.encode(message.parents[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.self != null && Object.hasOwnProperty.call(message, "self"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.self, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        if (message.declarations != null && Object.hasOwnProperty.call(message, "declarations"))
                            $root.scala.meta.internal.semanticdb.Scope.encode(message.declarations, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified ClassSignature message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ClassSignature.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.IClassSignature} message ClassSignature message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ClassSignature.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ClassSignature message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.ClassSignature} ClassSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ClassSignature.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ClassSignature();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    if (!(message.parents && message.parents.length))
                                        message.parents = [];
                                    message.parents.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                                    break;
                                }
                            case 3: {
                                    message.self = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            case 4: {
                                    message.declarations = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ClassSignature message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.ClassSignature} ClassSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ClassSignature.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ClassSignature message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ClassSignature.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.typeParameters != null && message.hasOwnProperty("typeParameters")) {
                            let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.typeParameters);
                            if (error)
                                return "typeParameters." + error;
                        }
                        if (message.parents != null && message.hasOwnProperty("parents")) {
                            if (!Array.isArray(message.parents))
                                return "parents: array expected";
                            for (let i = 0; i < message.parents.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.parents[i]);
                                if (error)
                                    return "parents." + error;
                            }
                        }
                        if (message.self != null && message.hasOwnProperty("self")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.self);
                            if (error)
                                return "self." + error;
                        }
                        if (message.declarations != null && message.hasOwnProperty("declarations")) {
                            let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.declarations);
                            if (error)
                                return "declarations." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a ClassSignature message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.ClassSignature} ClassSignature
                     */
                    ClassSignature.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.ClassSignature)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.ClassSignature();
                        if (object.typeParameters != null) {
                            if (typeof object.typeParameters !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.ClassSignature.typeParameters: object expected");
                            message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.typeParameters);
                        }
                        if (object.parents) {
                            if (!Array.isArray(object.parents))
                                throw TypeError(".scala.meta.internal.semanticdb.ClassSignature.parents: array expected");
                            message.parents = [];
                            for (let i = 0; i < object.parents.length; ++i) {
                                if (typeof object.parents[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.ClassSignature.parents: object expected");
                                message.parents[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.parents[i]);
                            }
                        }
                        if (object.self != null) {
                            if (typeof object.self !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.ClassSignature.self: object expected");
                            message.self = $root.scala.meta.internal.semanticdb.Type.fromObject(object.self);
                        }
                        if (object.declarations != null) {
                            if (typeof object.declarations !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.ClassSignature.declarations: object expected");
                            message.declarations = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.declarations);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a ClassSignature message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.ClassSignature} message ClassSignature
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ClassSignature.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.parents = [];
                        if (options.defaults) {
                            object.typeParameters = null;
                            object.self = null;
                            object.declarations = null;
                        }
                        if (message.typeParameters != null && message.hasOwnProperty("typeParameters"))
                            object.typeParameters = $root.scala.meta.internal.semanticdb.Scope.toObject(message.typeParameters, options);
                        if (message.parents && message.parents.length) {
                            object.parents = [];
                            for (let j = 0; j < message.parents.length; ++j)
                                object.parents[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.parents[j], options);
                        }
                        if (message.self != null && message.hasOwnProperty("self"))
                            object.self = $root.scala.meta.internal.semanticdb.Type.toObject(message.self, options);
                        if (message.declarations != null && message.hasOwnProperty("declarations"))
                            object.declarations = $root.scala.meta.internal.semanticdb.Scope.toObject(message.declarations, options);
                        return object;
                    };

                    /**
                     * Converts this ClassSignature to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ClassSignature.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ClassSignature
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.ClassSignature
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ClassSignature.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.ClassSignature";
                    };

                    return ClassSignature;
                })();

                semanticdb.MethodSignature = (function() {

                    /**
                     * Properties of a MethodSignature.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IMethodSignature
                     * @property {scala.meta.internal.semanticdb.IScope|null} [typeParameters] MethodSignature typeParameters
                     * @property {Array.<scala.meta.internal.semanticdb.IScope>|null} [parameterLists] MethodSignature parameterLists
                     * @property {scala.meta.internal.semanticdb.IType|null} [returnType] MethodSignature returnType
                     * @property {Array.<scala.meta.internal.semanticdb.IType>|null} [throws] MethodSignature throws
                     */

                    /**
                     * Constructs a new MethodSignature.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a MethodSignature.
                     * @implements IMethodSignature
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IMethodSignature=} [properties] Properties to set
                     */
                    function MethodSignature(properties) {
                        this.parameterLists = [];
                        this.throws = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * MethodSignature typeParameters.
                     * @member {scala.meta.internal.semanticdb.IScope|null|undefined} typeParameters
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @instance
                     */
                    MethodSignature.prototype.typeParameters = null;

                    /**
                     * MethodSignature parameterLists.
                     * @member {Array.<scala.meta.internal.semanticdb.IScope>} parameterLists
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @instance
                     */
                    MethodSignature.prototype.parameterLists = $util.emptyArray;

                    /**
                     * MethodSignature returnType.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} returnType
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @instance
                     */
                    MethodSignature.prototype.returnType = null;

                    /**
                     * MethodSignature throws.
                     * @member {Array.<scala.meta.internal.semanticdb.IType>} throws
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @instance
                     */
                    MethodSignature.prototype.throws = $util.emptyArray;

                    /**
                     * Creates a new MethodSignature instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.IMethodSignature=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.MethodSignature} MethodSignature instance
                     */
                    MethodSignature.create = function create(properties) {
                        return new MethodSignature(properties);
                    };

                    /**
                     * Encodes the specified MethodSignature message. Does not implicitly {@link scala.meta.internal.semanticdb.MethodSignature.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.IMethodSignature} message MethodSignature message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    MethodSignature.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.typeParameters != null && Object.hasOwnProperty.call(message, "typeParameters"))
                            $root.scala.meta.internal.semanticdb.Scope.encode(message.typeParameters, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.parameterLists != null && message.parameterLists.length)
                            for (let i = 0; i < message.parameterLists.length; ++i)
                                $root.scala.meta.internal.semanticdb.Scope.encode(message.parameterLists[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.returnType != null && Object.hasOwnProperty.call(message, "returnType"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.returnType, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        if (message.throws != null && message.throws.length)
                            for (let i = 0; i < message.throws.length; ++i)
                                $root.scala.meta.internal.semanticdb.Type.encode(message.throws[i], writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified MethodSignature message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.MethodSignature.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.IMethodSignature} message MethodSignature message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    MethodSignature.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a MethodSignature message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.MethodSignature} MethodSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    MethodSignature.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.MethodSignature();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    if (!(message.parameterLists && message.parameterLists.length))
                                        message.parameterLists = [];
                                    message.parameterLists.push($root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32()));
                                    break;
                                }
                            case 3: {
                                    message.returnType = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            case 4: {
                                    if (!(message.throws && message.throws.length))
                                        message.throws = [];
                                    message.throws.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a MethodSignature message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.MethodSignature} MethodSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    MethodSignature.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a MethodSignature message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    MethodSignature.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.typeParameters != null && message.hasOwnProperty("typeParameters")) {
                            let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.typeParameters);
                            if (error)
                                return "typeParameters." + error;
                        }
                        if (message.parameterLists != null && message.hasOwnProperty("parameterLists")) {
                            if (!Array.isArray(message.parameterLists))
                                return "parameterLists: array expected";
                            for (let i = 0; i < message.parameterLists.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.parameterLists[i]);
                                if (error)
                                    return "parameterLists." + error;
                            }
                        }
                        if (message.returnType != null && message.hasOwnProperty("returnType")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.returnType);
                            if (error)
                                return "returnType." + error;
                        }
                        if (message.throws != null && message.hasOwnProperty("throws")) {
                            if (!Array.isArray(message.throws))
                                return "throws: array expected";
                            for (let i = 0; i < message.throws.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.throws[i]);
                                if (error)
                                    return "throws." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates a MethodSignature message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.MethodSignature} MethodSignature
                     */
                    MethodSignature.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.MethodSignature)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.MethodSignature();
                        if (object.typeParameters != null) {
                            if (typeof object.typeParameters !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.MethodSignature.typeParameters: object expected");
                            message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.typeParameters);
                        }
                        if (object.parameterLists) {
                            if (!Array.isArray(object.parameterLists))
                                throw TypeError(".scala.meta.internal.semanticdb.MethodSignature.parameterLists: array expected");
                            message.parameterLists = [];
                            for (let i = 0; i < object.parameterLists.length; ++i) {
                                if (typeof object.parameterLists[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.MethodSignature.parameterLists: object expected");
                                message.parameterLists[i] = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.parameterLists[i]);
                            }
                        }
                        if (object.returnType != null) {
                            if (typeof object.returnType !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.MethodSignature.returnType: object expected");
                            message.returnType = $root.scala.meta.internal.semanticdb.Type.fromObject(object.returnType);
                        }
                        if (object.throws) {
                            if (!Array.isArray(object.throws))
                                throw TypeError(".scala.meta.internal.semanticdb.MethodSignature.throws: array expected");
                            message.throws = [];
                            for (let i = 0; i < object.throws.length; ++i) {
                                if (typeof object.throws[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.MethodSignature.throws: object expected");
                                message.throws[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.throws[i]);
                            }
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a MethodSignature message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.MethodSignature} message MethodSignature
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    MethodSignature.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults) {
                            object.parameterLists = [];
                            object.throws = [];
                        }
                        if (options.defaults) {
                            object.typeParameters = null;
                            object.returnType = null;
                        }
                        if (message.typeParameters != null && message.hasOwnProperty("typeParameters"))
                            object.typeParameters = $root.scala.meta.internal.semanticdb.Scope.toObject(message.typeParameters, options);
                        if (message.parameterLists && message.parameterLists.length) {
                            object.parameterLists = [];
                            for (let j = 0; j < message.parameterLists.length; ++j)
                                object.parameterLists[j] = $root.scala.meta.internal.semanticdb.Scope.toObject(message.parameterLists[j], options);
                        }
                        if (message.returnType != null && message.hasOwnProperty("returnType"))
                            object.returnType = $root.scala.meta.internal.semanticdb.Type.toObject(message.returnType, options);
                        if (message.throws && message.throws.length) {
                            object.throws = [];
                            for (let j = 0; j < message.throws.length; ++j)
                                object.throws[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.throws[j], options);
                        }
                        return object;
                    };

                    /**
                     * Converts this MethodSignature to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    MethodSignature.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for MethodSignature
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.MethodSignature
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    MethodSignature.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.MethodSignature";
                    };

                    return MethodSignature;
                })();

                semanticdb.TypeSignature = (function() {

                    /**
                     * Properties of a TypeSignature.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ITypeSignature
                     * @property {scala.meta.internal.semanticdb.IScope|null} [typeParameters] TypeSignature typeParameters
                     * @property {scala.meta.internal.semanticdb.IType|null} [lowerBound] TypeSignature lowerBound
                     * @property {scala.meta.internal.semanticdb.IType|null} [upperBound] TypeSignature upperBound
                     */

                    /**
                     * Constructs a new TypeSignature.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a TypeSignature.
                     * @implements ITypeSignature
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ITypeSignature=} [properties] Properties to set
                     */
                    function TypeSignature(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * TypeSignature typeParameters.
                     * @member {scala.meta.internal.semanticdb.IScope|null|undefined} typeParameters
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @instance
                     */
                    TypeSignature.prototype.typeParameters = null;

                    /**
                     * TypeSignature lowerBound.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} lowerBound
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @instance
                     */
                    TypeSignature.prototype.lowerBound = null;

                    /**
                     * TypeSignature upperBound.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} upperBound
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @instance
                     */
                    TypeSignature.prototype.upperBound = null;

                    /**
                     * Creates a new TypeSignature instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITypeSignature=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.TypeSignature} TypeSignature instance
                     */
                    TypeSignature.create = function create(properties) {
                        return new TypeSignature(properties);
                    };

                    /**
                     * Encodes the specified TypeSignature message. Does not implicitly {@link scala.meta.internal.semanticdb.TypeSignature.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITypeSignature} message TypeSignature message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    TypeSignature.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.typeParameters != null && Object.hasOwnProperty.call(message, "typeParameters"))
                            $root.scala.meta.internal.semanticdb.Scope.encode(message.typeParameters, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.lowerBound != null && Object.hasOwnProperty.call(message, "lowerBound"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.lowerBound, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.upperBound != null && Object.hasOwnProperty.call(message, "upperBound"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.upperBound, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified TypeSignature message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.TypeSignature.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITypeSignature} message TypeSignature message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    TypeSignature.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a TypeSignature message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.TypeSignature} TypeSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    TypeSignature.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.TypeSignature();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.lowerBound = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            case 3: {
                                    message.upperBound = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a TypeSignature message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.TypeSignature} TypeSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    TypeSignature.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a TypeSignature message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    TypeSignature.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.typeParameters != null && message.hasOwnProperty("typeParameters")) {
                            let error = $root.scala.meta.internal.semanticdb.Scope.verify(message.typeParameters);
                            if (error)
                                return "typeParameters." + error;
                        }
                        if (message.lowerBound != null && message.hasOwnProperty("lowerBound")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.lowerBound);
                            if (error)
                                return "lowerBound." + error;
                        }
                        if (message.upperBound != null && message.hasOwnProperty("upperBound")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.upperBound);
                            if (error)
                                return "upperBound." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a TypeSignature message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.TypeSignature} TypeSignature
                     */
                    TypeSignature.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.TypeSignature)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.TypeSignature();
                        if (object.typeParameters != null) {
                            if (typeof object.typeParameters !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.TypeSignature.typeParameters: object expected");
                            message.typeParameters = $root.scala.meta.internal.semanticdb.Scope.fromObject(object.typeParameters);
                        }
                        if (object.lowerBound != null) {
                            if (typeof object.lowerBound !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.TypeSignature.lowerBound: object expected");
                            message.lowerBound = $root.scala.meta.internal.semanticdb.Type.fromObject(object.lowerBound);
                        }
                        if (object.upperBound != null) {
                            if (typeof object.upperBound !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.TypeSignature.upperBound: object expected");
                            message.upperBound = $root.scala.meta.internal.semanticdb.Type.fromObject(object.upperBound);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a TypeSignature message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.TypeSignature} message TypeSignature
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    TypeSignature.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.typeParameters = null;
                            object.lowerBound = null;
                            object.upperBound = null;
                        }
                        if (message.typeParameters != null && message.hasOwnProperty("typeParameters"))
                            object.typeParameters = $root.scala.meta.internal.semanticdb.Scope.toObject(message.typeParameters, options);
                        if (message.lowerBound != null && message.hasOwnProperty("lowerBound"))
                            object.lowerBound = $root.scala.meta.internal.semanticdb.Type.toObject(message.lowerBound, options);
                        if (message.upperBound != null && message.hasOwnProperty("upperBound"))
                            object.upperBound = $root.scala.meta.internal.semanticdb.Type.toObject(message.upperBound, options);
                        return object;
                    };

                    /**
                     * Converts this TypeSignature to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    TypeSignature.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for TypeSignature
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.TypeSignature
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    TypeSignature.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.TypeSignature";
                    };

                    return TypeSignature;
                })();

                semanticdb.ValueSignature = (function() {

                    /**
                     * Properties of a ValueSignature.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IValueSignature
                     * @property {scala.meta.internal.semanticdb.IType|null} [tpe] ValueSignature tpe
                     */

                    /**
                     * Constructs a new ValueSignature.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a ValueSignature.
                     * @implements IValueSignature
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IValueSignature=} [properties] Properties to set
                     */
                    function ValueSignature(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ValueSignature tpe.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} tpe
                     * @memberof scala.meta.internal.semanticdb.ValueSignature
                     * @instance
                     */
                    ValueSignature.prototype.tpe = null;

                    /**
                     * Creates a new ValueSignature instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.ValueSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.IValueSignature=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.ValueSignature} ValueSignature instance
                     */
                    ValueSignature.create = function create(properties) {
                        return new ValueSignature(properties);
                    };

                    /**
                     * Encodes the specified ValueSignature message. Does not implicitly {@link scala.meta.internal.semanticdb.ValueSignature.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.ValueSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.IValueSignature} message ValueSignature message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ValueSignature.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified ValueSignature message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ValueSignature.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ValueSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.IValueSignature} message ValueSignature message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ValueSignature.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ValueSignature message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.ValueSignature
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.ValueSignature} ValueSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ValueSignature.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ValueSignature();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ValueSignature message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ValueSignature
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.ValueSignature} ValueSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ValueSignature.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ValueSignature message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.ValueSignature
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ValueSignature.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.tpe != null && message.hasOwnProperty("tpe")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
                            if (error)
                                return "tpe." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a ValueSignature message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.ValueSignature
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.ValueSignature} ValueSignature
                     */
                    ValueSignature.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.ValueSignature)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.ValueSignature();
                        if (object.tpe != null) {
                            if (typeof object.tpe !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.ValueSignature.tpe: object expected");
                            message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a ValueSignature message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.ValueSignature
                     * @static
                     * @param {scala.meta.internal.semanticdb.ValueSignature} message ValueSignature
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ValueSignature.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.tpe = null;
                        if (message.tpe != null && message.hasOwnProperty("tpe"))
                            object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
                        return object;
                    };

                    /**
                     * Converts this ValueSignature to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.ValueSignature
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ValueSignature.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ValueSignature
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.ValueSignature
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ValueSignature.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.ValueSignature";
                    };

                    return ValueSignature;
                })();

                semanticdb.SymbolInformation = (function() {

                    /**
                     * Properties of a SymbolInformation.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ISymbolInformation
                     * @property {string|null} [symbol] SymbolInformation symbol
                     * @property {scala.meta.internal.semanticdb.Language|null} [language] SymbolInformation language
                     * @property {scala.meta.internal.semanticdb.SymbolInformation.Kind|null} [kind] SymbolInformation kind
                     * @property {number|null} [properties] SymbolInformation properties
                     * @property {string|null} [displayName] SymbolInformation displayName
                     * @property {scala.meta.internal.semanticdb.ISignature|null} [signature] SymbolInformation signature
                     * @property {Array.<scala.meta.internal.semanticdb.IAnnotationTree>|null} [annotations] SymbolInformation annotations
                     * @property {scala.meta.internal.semanticdb.IAccess|null} [access] SymbolInformation access
                     * @property {Array.<string>|null} [overriddenSymbols] SymbolInformation overriddenSymbols
                     * @property {scala.meta.internal.semanticdb.IDocumentation|null} [documentation] SymbolInformation documentation
                     */

                    /**
                     * Constructs a new SymbolInformation.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a SymbolInformation.
                     * @implements ISymbolInformation
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ISymbolInformation=} [properties] Properties to set
                     */
                    function SymbolInformation(properties) {
                        this.annotations = [];
                        this.overriddenSymbols = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * SymbolInformation symbol.
                     * @member {string} symbol
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @instance
                     */
                    SymbolInformation.prototype.symbol = "";

                    /**
                     * SymbolInformation language.
                     * @member {scala.meta.internal.semanticdb.Language} language
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @instance
                     */
                    SymbolInformation.prototype.language = 0;

                    /**
                     * SymbolInformation kind.
                     * @member {scala.meta.internal.semanticdb.SymbolInformation.Kind} kind
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @instance
                     */
                    SymbolInformation.prototype.kind = 0;

                    /**
                     * SymbolInformation properties.
                     * @member {number} properties
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @instance
                     */
                    SymbolInformation.prototype.properties = 0;

                    /**
                     * SymbolInformation displayName.
                     * @member {string} displayName
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @instance
                     */
                    SymbolInformation.prototype.displayName = "";

                    /**
                     * SymbolInformation signature.
                     * @member {scala.meta.internal.semanticdb.ISignature|null|undefined} signature
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @instance
                     */
                    SymbolInformation.prototype.signature = null;

                    /**
                     * SymbolInformation annotations.
                     * @member {Array.<scala.meta.internal.semanticdb.IAnnotationTree>} annotations
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @instance
                     */
                    SymbolInformation.prototype.annotations = $util.emptyArray;

                    /**
                     * SymbolInformation access.
                     * @member {scala.meta.internal.semanticdb.IAccess|null|undefined} access
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @instance
                     */
                    SymbolInformation.prototype.access = null;

                    /**
                     * SymbolInformation overriddenSymbols.
                     * @member {Array.<string>} overriddenSymbols
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @instance
                     */
                    SymbolInformation.prototype.overriddenSymbols = $util.emptyArray;

                    /**
                     * SymbolInformation documentation.
                     * @member {scala.meta.internal.semanticdb.IDocumentation|null|undefined} documentation
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @instance
                     */
                    SymbolInformation.prototype.documentation = null;

                    /**
                     * Creates a new SymbolInformation instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISymbolInformation=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.SymbolInformation} SymbolInformation instance
                     */
                    SymbolInformation.create = function create(properties) {
                        return new SymbolInformation(properties);
                    };

                    /**
                     * Encodes the specified SymbolInformation message. Does not implicitly {@link scala.meta.internal.semanticdb.SymbolInformation.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISymbolInformation} message SymbolInformation message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    SymbolInformation.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.symbol);
                        if (message.kind != null && Object.hasOwnProperty.call(message, "kind"))
                            writer.uint32(/* id 3, wireType 0 =*/24).int32(message.kind);
                        if (message.properties != null && Object.hasOwnProperty.call(message, "properties"))
                            writer.uint32(/* id 4, wireType 0 =*/32).int32(message.properties);
                        if (message.displayName != null && Object.hasOwnProperty.call(message, "displayName"))
                            writer.uint32(/* id 5, wireType 2 =*/42).string(message.displayName);
                        if (message.annotations != null && message.annotations.length)
                            for (let i = 0; i < message.annotations.length; ++i)
                                $root.scala.meta.internal.semanticdb.AnnotationTree.encode(message.annotations[i], writer.uint32(/* id 13, wireType 2 =*/106).fork()).ldelim();
                        if (message.language != null && Object.hasOwnProperty.call(message, "language"))
                            writer.uint32(/* id 16, wireType 0 =*/128).int32(message.language);
                        if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
                            $root.scala.meta.internal.semanticdb.Signature.encode(message.signature, writer.uint32(/* id 17, wireType 2 =*/138).fork()).ldelim();
                        if (message.access != null && Object.hasOwnProperty.call(message, "access"))
                            $root.scala.meta.internal.semanticdb.Access.encode(message.access, writer.uint32(/* id 18, wireType 2 =*/146).fork()).ldelim();
                        if (message.overriddenSymbols != null && message.overriddenSymbols.length)
                            for (let i = 0; i < message.overriddenSymbols.length; ++i)
                                writer.uint32(/* id 19, wireType 2 =*/154).string(message.overriddenSymbols[i]);
                        if (message.documentation != null && Object.hasOwnProperty.call(message, "documentation"))
                            $root.scala.meta.internal.semanticdb.Documentation.encode(message.documentation, writer.uint32(/* id 20, wireType 2 =*/162).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified SymbolInformation message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.SymbolInformation.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISymbolInformation} message SymbolInformation message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    SymbolInformation.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a SymbolInformation message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.SymbolInformation} SymbolInformation
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    SymbolInformation.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.SymbolInformation();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.symbol = reader.string();
                                    break;
                                }
                            case 16: {
                                    message.language = reader.int32();
                                    break;
                                }
                            case 3: {
                                    message.kind = reader.int32();
                                    break;
                                }
                            case 4: {
                                    message.properties = reader.int32();
                                    break;
                                }
                            case 5: {
                                    message.displayName = reader.string();
                                    break;
                                }
                            case 17: {
                                    message.signature = $root.scala.meta.internal.semanticdb.Signature.decode(reader, reader.uint32());
                                    break;
                                }
                            case 13: {
                                    if (!(message.annotations && message.annotations.length))
                                        message.annotations = [];
                                    message.annotations.push($root.scala.meta.internal.semanticdb.AnnotationTree.decode(reader, reader.uint32()));
                                    break;
                                }
                            case 18: {
                                    message.access = $root.scala.meta.internal.semanticdb.Access.decode(reader, reader.uint32());
                                    break;
                                }
                            case 19: {
                                    if (!(message.overriddenSymbols && message.overriddenSymbols.length))
                                        message.overriddenSymbols = [];
                                    message.overriddenSymbols.push(reader.string());
                                    break;
                                }
                            case 20: {
                                    message.documentation = $root.scala.meta.internal.semanticdb.Documentation.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a SymbolInformation message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.SymbolInformation} SymbolInformation
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    SymbolInformation.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a SymbolInformation message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    SymbolInformation.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            if (!$util.isString(message.symbol))
                                return "symbol: string expected";
                        if (message.language != null && message.hasOwnProperty("language"))
                            switch (message.language) {
                            default:
                                return "language: enum value expected";
                            case 0:
                            case 1:
                            case 2:
                            case 3:
                                break;
                            }
                        if (message.kind != null && message.hasOwnProperty("kind"))
                            switch (message.kind) {
                            default:
                                return "kind: enum value expected";
                            case 0:
                            case 19:
                            case 20:
                            case 3:
                            case 21:
                            case 6:
                            case 7:
                            case 8:
                            case 17:
                            case 9:
                            case 10:
                            case 11:
                            case 12:
                            case 13:
                            case 14:
                            case 18:
                            case 22:
                            case 23:
                            case 24:
                            case 25:
                            case 26:
                            case 27:
                            case 28:
                                break;
                            }
                        if (message.properties != null && message.hasOwnProperty("properties"))
                            if (!$util.isInteger(message.properties))
                                return "properties: integer expected";
                        if (message.displayName != null && message.hasOwnProperty("displayName"))
                            if (!$util.isString(message.displayName))
                                return "displayName: string expected";
                        if (message.signature != null && message.hasOwnProperty("signature")) {
                            let error = $root.scala.meta.internal.semanticdb.Signature.verify(message.signature);
                            if (error)
                                return "signature." + error;
                        }
                        if (message.annotations != null && message.hasOwnProperty("annotations")) {
                            if (!Array.isArray(message.annotations))
                                return "annotations: array expected";
                            for (let i = 0; i < message.annotations.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.AnnotationTree.verify(message.annotations[i]);
                                if (error)
                                    return "annotations." + error;
                            }
                        }
                        if (message.access != null && message.hasOwnProperty("access")) {
                            let error = $root.scala.meta.internal.semanticdb.Access.verify(message.access);
                            if (error)
                                return "access." + error;
                        }
                        if (message.overriddenSymbols != null && message.hasOwnProperty("overriddenSymbols")) {
                            if (!Array.isArray(message.overriddenSymbols))
                                return "overriddenSymbols: array expected";
                            for (let i = 0; i < message.overriddenSymbols.length; ++i)
                                if (!$util.isString(message.overriddenSymbols[i]))
                                    return "overriddenSymbols: string[] expected";
                        }
                        if (message.documentation != null && message.hasOwnProperty("documentation")) {
                            let error = $root.scala.meta.internal.semanticdb.Documentation.verify(message.documentation);
                            if (error)
                                return "documentation." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a SymbolInformation message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.SymbolInformation} SymbolInformation
                     */
                    SymbolInformation.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.SymbolInformation)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.SymbolInformation();
                        if (object.symbol != null)
                            message.symbol = String(object.symbol);
                        switch (object.language) {
                        default:
                            if (typeof object.language === "number") {
                                message.language = object.language;
                                break;
                            }
                            break;
                        case "UNKNOWN_LANGUAGE":
                        case 0:
                            message.language = 0;
                            break;
                        case "SCALA":
                        case 1:
                            message.language = 1;
                            break;
                        case "JAVA":
                        case 2:
                            message.language = 2;
                            break;
                        case "PROTOBUF":
                        case 3:
                            message.language = 3;
                            break;
                        }
                        switch (object.kind) {
                        default:
                            if (typeof object.kind === "number") {
                                message.kind = object.kind;
                                break;
                            }
                            break;
                        case "UNKNOWN_KIND":
                        case 0:
                            message.kind = 0;
                            break;
                        case "LOCAL":
                        case 19:
                            message.kind = 19;
                            break;
                        case "FIELD":
                        case 20:
                            message.kind = 20;
                            break;
                        case "METHOD":
                        case 3:
                            message.kind = 3;
                            break;
                        case "CONSTRUCTOR":
                        case 21:
                            message.kind = 21;
                            break;
                        case "MACRO":
                        case 6:
                            message.kind = 6;
                            break;
                        case "TYPE":
                        case 7:
                            message.kind = 7;
                            break;
                        case "PARAMETER":
                        case 8:
                            message.kind = 8;
                            break;
                        case "SELF_PARAMETER":
                        case 17:
                            message.kind = 17;
                            break;
                        case "TYPE_PARAMETER":
                        case 9:
                            message.kind = 9;
                            break;
                        case "OBJECT":
                        case 10:
                            message.kind = 10;
                            break;
                        case "PACKAGE":
                        case 11:
                            message.kind = 11;
                            break;
                        case "PACKAGE_OBJECT":
                        case 12:
                            message.kind = 12;
                            break;
                        case "CLASS":
                        case 13:
                            message.kind = 13;
                            break;
                        case "TRAIT":
                        case 14:
                            message.kind = 14;
                            break;
                        case "INTERFACE":
                        case 18:
                            message.kind = 18;
                            break;
                        case "MESSAGE":
                        case 22:
                            message.kind = 22;
                            break;
                        case "PROTOBUF_ENUM":
                        case 23:
                            message.kind = 23;
                            break;
                        case "PROTOBUF_ENUM_VALUE":
                        case 24:
                            message.kind = 24;
                            break;
                        case "SERVICE":
                        case 25:
                            message.kind = 25;
                            break;
                        case "RPC":
                        case 26:
                            message.kind = 26;
                            break;
                        case "ONEOF":
                        case 27:
                            message.kind = 27;
                            break;
                        case "FILE":
                        case 28:
                            message.kind = 28;
                            break;
                        }
                        if (object.properties != null)
                            message.properties = object.properties | 0;
                        if (object.displayName != null)
                            message.displayName = String(object.displayName);
                        if (object.signature != null) {
                            if (typeof object.signature !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.SymbolInformation.signature: object expected");
                            message.signature = $root.scala.meta.internal.semanticdb.Signature.fromObject(object.signature);
                        }
                        if (object.annotations) {
                            if (!Array.isArray(object.annotations))
                                throw TypeError(".scala.meta.internal.semanticdb.SymbolInformation.annotations: array expected");
                            message.annotations = [];
                            for (let i = 0; i < object.annotations.length; ++i) {
                                if (typeof object.annotations[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.SymbolInformation.annotations: object expected");
                                message.annotations[i] = $root.scala.meta.internal.semanticdb.AnnotationTree.fromObject(object.annotations[i]);
                            }
                        }
                        if (object.access != null) {
                            if (typeof object.access !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.SymbolInformation.access: object expected");
                            message.access = $root.scala.meta.internal.semanticdb.Access.fromObject(object.access);
                        }
                        if (object.overriddenSymbols) {
                            if (!Array.isArray(object.overriddenSymbols))
                                throw TypeError(".scala.meta.internal.semanticdb.SymbolInformation.overriddenSymbols: array expected");
                            message.overriddenSymbols = [];
                            for (let i = 0; i < object.overriddenSymbols.length; ++i)
                                message.overriddenSymbols[i] = String(object.overriddenSymbols[i]);
                        }
                        if (object.documentation != null) {
                            if (typeof object.documentation !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.SymbolInformation.documentation: object expected");
                            message.documentation = $root.scala.meta.internal.semanticdb.Documentation.fromObject(object.documentation);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a SymbolInformation message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @static
                     * @param {scala.meta.internal.semanticdb.SymbolInformation} message SymbolInformation
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    SymbolInformation.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults) {
                            object.annotations = [];
                            object.overriddenSymbols = [];
                        }
                        if (options.defaults) {
                            object.symbol = "";
                            object.kind = options.enums === String ? "UNKNOWN_KIND" : 0;
                            object.properties = 0;
                            object.displayName = "";
                            object.language = options.enums === String ? "UNKNOWN_LANGUAGE" : 0;
                            object.signature = null;
                            object.access = null;
                            object.documentation = null;
                        }
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            object.symbol = message.symbol;
                        if (message.kind != null && message.hasOwnProperty("kind"))
                            object.kind = options.enums === String ? $root.scala.meta.internal.semanticdb.SymbolInformation.Kind[message.kind] === undefined ? message.kind : $root.scala.meta.internal.semanticdb.SymbolInformation.Kind[message.kind] : message.kind;
                        if (message.properties != null && message.hasOwnProperty("properties"))
                            object.properties = message.properties;
                        if (message.displayName != null && message.hasOwnProperty("displayName"))
                            object.displayName = message.displayName;
                        if (message.annotations && message.annotations.length) {
                            object.annotations = [];
                            for (let j = 0; j < message.annotations.length; ++j)
                                object.annotations[j] = $root.scala.meta.internal.semanticdb.AnnotationTree.toObject(message.annotations[j], options);
                        }
                        if (message.language != null && message.hasOwnProperty("language"))
                            object.language = options.enums === String ? $root.scala.meta.internal.semanticdb.Language[message.language] === undefined ? message.language : $root.scala.meta.internal.semanticdb.Language[message.language] : message.language;
                        if (message.signature != null && message.hasOwnProperty("signature"))
                            object.signature = $root.scala.meta.internal.semanticdb.Signature.toObject(message.signature, options);
                        if (message.access != null && message.hasOwnProperty("access"))
                            object.access = $root.scala.meta.internal.semanticdb.Access.toObject(message.access, options);
                        if (message.overriddenSymbols && message.overriddenSymbols.length) {
                            object.overriddenSymbols = [];
                            for (let j = 0; j < message.overriddenSymbols.length; ++j)
                                object.overriddenSymbols[j] = message.overriddenSymbols[j];
                        }
                        if (message.documentation != null && message.hasOwnProperty("documentation"))
                            object.documentation = $root.scala.meta.internal.semanticdb.Documentation.toObject(message.documentation, options);
                        return object;
                    };

                    /**
                     * Converts this SymbolInformation to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    SymbolInformation.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for SymbolInformation
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.SymbolInformation
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    SymbolInformation.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.SymbolInformation";
                    };

                    /**
                     * Kind enum.
                     * @name scala.meta.internal.semanticdb.SymbolInformation.Kind
                     * @enum {number}
                     * @property {number} UNKNOWN_KIND=0 UNKNOWN_KIND value
                     * @property {number} LOCAL=19 LOCAL value
                     * @property {number} FIELD=20 FIELD value
                     * @property {number} METHOD=3 METHOD value
                     * @property {number} CONSTRUCTOR=21 CONSTRUCTOR value
                     * @property {number} MACRO=6 MACRO value
                     * @property {number} TYPE=7 TYPE value
                     * @property {number} PARAMETER=8 PARAMETER value
                     * @property {number} SELF_PARAMETER=17 SELF_PARAMETER value
                     * @property {number} TYPE_PARAMETER=9 TYPE_PARAMETER value
                     * @property {number} OBJECT=10 OBJECT value
                     * @property {number} PACKAGE=11 PACKAGE value
                     * @property {number} PACKAGE_OBJECT=12 PACKAGE_OBJECT value
                     * @property {number} CLASS=13 CLASS value
                     * @property {number} TRAIT=14 TRAIT value
                     * @property {number} INTERFACE=18 INTERFACE value
                     * @property {number} MESSAGE=22 MESSAGE value
                     * @property {number} PROTOBUF_ENUM=23 PROTOBUF_ENUM value
                     * @property {number} PROTOBUF_ENUM_VALUE=24 PROTOBUF_ENUM_VALUE value
                     * @property {number} SERVICE=25 SERVICE value
                     * @property {number} RPC=26 RPC value
                     * @property {number} ONEOF=27 ONEOF value
                     * @property {number} FILE=28 FILE value
                     */
                    SymbolInformation.Kind = (function() {
                        const valuesById = {}, values = Object.create(valuesById);
                        values[valuesById[0] = "UNKNOWN_KIND"] = 0;
                        values[valuesById[19] = "LOCAL"] = 19;
                        values[valuesById[20] = "FIELD"] = 20;
                        values[valuesById[3] = "METHOD"] = 3;
                        values[valuesById[21] = "CONSTRUCTOR"] = 21;
                        values[valuesById[6] = "MACRO"] = 6;
                        values[valuesById[7] = "TYPE"] = 7;
                        values[valuesById[8] = "PARAMETER"] = 8;
                        values[valuesById[17] = "SELF_PARAMETER"] = 17;
                        values[valuesById[9] = "TYPE_PARAMETER"] = 9;
                        values[valuesById[10] = "OBJECT"] = 10;
                        values[valuesById[11] = "PACKAGE"] = 11;
                        values[valuesById[12] = "PACKAGE_OBJECT"] = 12;
                        values[valuesById[13] = "CLASS"] = 13;
                        values[valuesById[14] = "TRAIT"] = 14;
                        values[valuesById[18] = "INTERFACE"] = 18;
                        values[valuesById[22] = "MESSAGE"] = 22;
                        values[valuesById[23] = "PROTOBUF_ENUM"] = 23;
                        values[valuesById[24] = "PROTOBUF_ENUM_VALUE"] = 24;
                        values[valuesById[25] = "SERVICE"] = 25;
                        values[valuesById[26] = "RPC"] = 26;
                        values[valuesById[27] = "ONEOF"] = 27;
                        values[valuesById[28] = "FILE"] = 28;
                        return values;
                    })();

                    /**
                     * Property enum.
                     * @name scala.meta.internal.semanticdb.SymbolInformation.Property
                     * @enum {number}
                     * @property {number} UNKNOWN_PROPERTY=0 UNKNOWN_PROPERTY value
                     * @property {number} ABSTRACT=4 ABSTRACT value
                     * @property {number} FINAL=8 FINAL value
                     * @property {number} SEALED=16 SEALED value
                     * @property {number} IMPLICIT=32 IMPLICIT value
                     * @property {number} LAZY=64 LAZY value
                     * @property {number} CASE=128 CASE value
                     * @property {number} COVARIANT=256 COVARIANT value
                     * @property {number} CONTRAVARIANT=512 CONTRAVARIANT value
                     * @property {number} VAL=1024 VAL value
                     * @property {number} VAR=2048 VAR value
                     * @property {number} STATIC=4096 STATIC value
                     * @property {number} PRIMARY=8192 PRIMARY value
                     * @property {number} ENUM=16384 ENUM value
                     * @property {number} DEFAULT=32768 DEFAULT value
                     * @property {number} GIVEN=65536 GIVEN value
                     * @property {number} INLINE=131072 INLINE value
                     * @property {number} OPEN=262144 OPEN value
                     * @property {number} TRANSPARENT=524288 TRANSPARENT value
                     * @property {number} INFIX=1048576 INFIX value
                     * @property {number} OPAQUE=2097152 OPAQUE value
                     * @property {number} OVERRIDE=4194304 OVERRIDE value
                     * @property {number} SYNTHETIC=8388608 SYNTHETIC value
                     */
                    SymbolInformation.Property = (function() {
                        const valuesById = {}, values = Object.create(valuesById);
                        values[valuesById[0] = "UNKNOWN_PROPERTY"] = 0;
                        values[valuesById[4] = "ABSTRACT"] = 4;
                        values[valuesById[8] = "FINAL"] = 8;
                        values[valuesById[16] = "SEALED"] = 16;
                        values[valuesById[32] = "IMPLICIT"] = 32;
                        values[valuesById[64] = "LAZY"] = 64;
                        values[valuesById[128] = "CASE"] = 128;
                        values[valuesById[256] = "COVARIANT"] = 256;
                        values[valuesById[512] = "CONTRAVARIANT"] = 512;
                        values[valuesById[1024] = "VAL"] = 1024;
                        values[valuesById[2048] = "VAR"] = 2048;
                        values[valuesById[4096] = "STATIC"] = 4096;
                        values[valuesById[8192] = "PRIMARY"] = 8192;
                        values[valuesById[16384] = "ENUM"] = 16384;
                        values[valuesById[32768] = "DEFAULT"] = 32768;
                        values[valuesById[65536] = "GIVEN"] = 65536;
                        values[valuesById[131072] = "INLINE"] = 131072;
                        values[valuesById[262144] = "OPEN"] = 262144;
                        values[valuesById[524288] = "TRANSPARENT"] = 524288;
                        values[valuesById[1048576] = "INFIX"] = 1048576;
                        values[valuesById[2097152] = "OPAQUE"] = 2097152;
                        values[valuesById[4194304] = "OVERRIDE"] = 4194304;
                        values[valuesById[8388608] = "SYNTHETIC"] = 8388608;
                        return values;
                    })();

                    return SymbolInformation;
                })();

                semanticdb.Documentation = (function() {

                    /**
                     * Properties of a Documentation.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IDocumentation
                     * @property {string|null} [message] Documentation message
                     * @property {scala.meta.internal.semanticdb.Documentation.Format|null} [format] Documentation format
                     */

                    /**
                     * Constructs a new Documentation.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a Documentation.
                     * @implements IDocumentation
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IDocumentation=} [properties] Properties to set
                     */
                    function Documentation(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Documentation message.
                     * @member {string} message
                     * @memberof scala.meta.internal.semanticdb.Documentation
                     * @instance
                     */
                    Documentation.prototype.message = "";

                    /**
                     * Documentation format.
                     * @member {scala.meta.internal.semanticdb.Documentation.Format} format
                     * @memberof scala.meta.internal.semanticdb.Documentation
                     * @instance
                     */
                    Documentation.prototype.format = 0;

                    /**
                     * Creates a new Documentation instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.Documentation
                     * @static
                     * @param {scala.meta.internal.semanticdb.IDocumentation=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.Documentation} Documentation instance
                     */
                    Documentation.create = function create(properties) {
                        return new Documentation(properties);
                    };

                    /**
                     * Encodes the specified Documentation message. Does not implicitly {@link scala.meta.internal.semanticdb.Documentation.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.Documentation
                     * @static
                     * @param {scala.meta.internal.semanticdb.IDocumentation} message Documentation message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Documentation.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.message != null && Object.hasOwnProperty.call(message, "message"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.message);
                        if (message.format != null && Object.hasOwnProperty.call(message, "format"))
                            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.format);
                        return writer;
                    };

                    /**
                     * Encodes the specified Documentation message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Documentation.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Documentation
                     * @static
                     * @param {scala.meta.internal.semanticdb.IDocumentation} message Documentation message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Documentation.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Documentation message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.Documentation
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.Documentation} Documentation
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Documentation.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Documentation();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.message = reader.string();
                                    break;
                                }
                            case 2: {
                                    message.format = reader.int32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Documentation message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Documentation
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.Documentation} Documentation
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Documentation.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Documentation message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.Documentation
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Documentation.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.message != null && message.hasOwnProperty("message"))
                            if (!$util.isString(message.message))
                                return "message: string expected";
                        if (message.format != null && message.hasOwnProperty("format"))
                            switch (message.format) {
                            default:
                                return "format: enum value expected";
                            case 0:
                            case 1:
                            case 2:
                            case 3:
                            case 4:
                                break;
                            }
                        return null;
                    };

                    /**
                     * Creates a Documentation message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.Documentation
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.Documentation} Documentation
                     */
                    Documentation.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.Documentation)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.Documentation();
                        if (object.message != null)
                            message.message = String(object.message);
                        switch (object.format) {
                        default:
                            if (typeof object.format === "number") {
                                message.format = object.format;
                                break;
                            }
                            break;
                        case "HTML":
                        case 0:
                            message.format = 0;
                            break;
                        case "MARKDOWN":
                        case 1:
                            message.format = 1;
                            break;
                        case "JAVADOC":
                        case 2:
                            message.format = 2;
                            break;
                        case "SCALADOC":
                        case 3:
                            message.format = 3;
                            break;
                        case "KDOC":
                        case 4:
                            message.format = 4;
                            break;
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a Documentation message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.Documentation
                     * @static
                     * @param {scala.meta.internal.semanticdb.Documentation} message Documentation
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Documentation.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.message = "";
                            object.format = options.enums === String ? "HTML" : 0;
                        }
                        if (message.message != null && message.hasOwnProperty("message"))
                            object.message = message.message;
                        if (message.format != null && message.hasOwnProperty("format"))
                            object.format = options.enums === String ? $root.scala.meta.internal.semanticdb.Documentation.Format[message.format] === undefined ? message.format : $root.scala.meta.internal.semanticdb.Documentation.Format[message.format] : message.format;
                        return object;
                    };

                    /**
                     * Converts this Documentation to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.Documentation
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Documentation.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Documentation
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.Documentation
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Documentation.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.Documentation";
                    };

                    /**
                     * Format enum.
                     * @name scala.meta.internal.semanticdb.Documentation.Format
                     * @enum {number}
                     * @property {number} HTML=0 HTML value
                     * @property {number} MARKDOWN=1 MARKDOWN value
                     * @property {number} JAVADOC=2 JAVADOC value
                     * @property {number} SCALADOC=3 SCALADOC value
                     * @property {number} KDOC=4 KDOC value
                     */
                    Documentation.Format = (function() {
                        const valuesById = {}, values = Object.create(valuesById);
                        values[valuesById[0] = "HTML"] = 0;
                        values[valuesById[1] = "MARKDOWN"] = 1;
                        values[valuesById[2] = "JAVADOC"] = 2;
                        values[valuesById[3] = "SCALADOC"] = 3;
                        values[valuesById[4] = "KDOC"] = 4;
                        return values;
                    })();

                    return Documentation;
                })();

                semanticdb.AnnotationTree = (function() {

                    /**
                     * Properties of an AnnotationTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IAnnotationTree
                     * @property {scala.meta.internal.semanticdb.IType|null} [tpe] AnnotationTree tpe
                     * @property {Array.<scala.meta.internal.semanticdb.ITree>|null} ["arguments"] AnnotationTree arguments
                     */

                    /**
                     * Constructs a new AnnotationTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an AnnotationTree.
                     * @implements IAnnotationTree
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IAnnotationTree=} [properties] Properties to set
                     */
                    function AnnotationTree(properties) {
                        this["arguments"] = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * AnnotationTree tpe.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} tpe
                     * @memberof scala.meta.internal.semanticdb.AnnotationTree
                     * @instance
                     */
                    AnnotationTree.prototype.tpe = null;

                    /**
                     * AnnotationTree arguments.
                     * @member {Array.<scala.meta.internal.semanticdb.ITree>} arguments
                     * @memberof scala.meta.internal.semanticdb.AnnotationTree
                     * @instance
                     */
                    AnnotationTree.prototype["arguments"] = $util.emptyArray;

                    /**
                     * Creates a new AnnotationTree instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.AnnotationTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IAnnotationTree=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.AnnotationTree} AnnotationTree instance
                     */
                    AnnotationTree.create = function create(properties) {
                        return new AnnotationTree(properties);
                    };

                    /**
                     * Encodes the specified AnnotationTree message. Does not implicitly {@link scala.meta.internal.semanticdb.AnnotationTree.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.AnnotationTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IAnnotationTree} message AnnotationTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    AnnotationTree.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message["arguments"] != null && message["arguments"].length)
                            for (let i = 0; i < message["arguments"].length; ++i)
                                $root.scala.meta.internal.semanticdb.Tree.encode(message["arguments"][i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified AnnotationTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.AnnotationTree.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.AnnotationTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IAnnotationTree} message AnnotationTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    AnnotationTree.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an AnnotationTree message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.AnnotationTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.AnnotationTree} AnnotationTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    AnnotationTree.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.AnnotationTree();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    if (!(message["arguments"] && message["arguments"].length))
                                        message["arguments"] = [];
                                    message["arguments"].push($root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32()));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an AnnotationTree message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.AnnotationTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.AnnotationTree} AnnotationTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    AnnotationTree.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an AnnotationTree message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.AnnotationTree
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    AnnotationTree.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.tpe != null && message.hasOwnProperty("tpe")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
                            if (error)
                                return "tpe." + error;
                        }
                        if (message["arguments"] != null && message.hasOwnProperty("arguments")) {
                            if (!Array.isArray(message["arguments"]))
                                return "arguments: array expected";
                            for (let i = 0; i < message["arguments"].length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.Tree.verify(message["arguments"][i]);
                                if (error)
                                    return "arguments." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates an AnnotationTree message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.AnnotationTree
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.AnnotationTree} AnnotationTree
                     */
                    AnnotationTree.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.AnnotationTree)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.AnnotationTree();
                        if (object.tpe != null) {
                            if (typeof object.tpe !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.AnnotationTree.tpe: object expected");
                            message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
                        }
                        if (object["arguments"]) {
                            if (!Array.isArray(object["arguments"]))
                                throw TypeError(".scala.meta.internal.semanticdb.AnnotationTree.arguments: array expected");
                            message["arguments"] = [];
                            for (let i = 0; i < object["arguments"].length; ++i) {
                                if (typeof object["arguments"][i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.AnnotationTree.arguments: object expected");
                                message["arguments"][i] = $root.scala.meta.internal.semanticdb.Tree.fromObject(object["arguments"][i]);
                            }
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from an AnnotationTree message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.AnnotationTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.AnnotationTree} message AnnotationTree
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    AnnotationTree.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object["arguments"] = [];
                        if (options.defaults)
                            object.tpe = null;
                        if (message.tpe != null && message.hasOwnProperty("tpe"))
                            object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
                        if (message["arguments"] && message["arguments"].length) {
                            object["arguments"] = [];
                            for (let j = 0; j < message["arguments"].length; ++j)
                                object["arguments"][j] = $root.scala.meta.internal.semanticdb.Tree.toObject(message["arguments"][j], options);
                        }
                        return object;
                    };

                    /**
                     * Converts this AnnotationTree to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.AnnotationTree
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    AnnotationTree.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for AnnotationTree
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.AnnotationTree
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    AnnotationTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.AnnotationTree";
                    };

                    return AnnotationTree;
                })();

                semanticdb.AssignTree = (function() {

                    /**
                     * Properties of an AssignTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IAssignTree
                     * @property {scala.meta.internal.semanticdb.ITree|null} [lhs] AssignTree lhs
                     * @property {scala.meta.internal.semanticdb.ITree|null} [rhs] AssignTree rhs
                     */

                    /**
                     * Constructs a new AssignTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an AssignTree.
                     * @implements IAssignTree
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IAssignTree=} [properties] Properties to set
                     */
                    function AssignTree(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * AssignTree lhs.
                     * @member {scala.meta.internal.semanticdb.ITree|null|undefined} lhs
                     * @memberof scala.meta.internal.semanticdb.AssignTree
                     * @instance
                     */
                    AssignTree.prototype.lhs = null;

                    /**
                     * AssignTree rhs.
                     * @member {scala.meta.internal.semanticdb.ITree|null|undefined} rhs
                     * @memberof scala.meta.internal.semanticdb.AssignTree
                     * @instance
                     */
                    AssignTree.prototype.rhs = null;

                    /**
                     * Creates a new AssignTree instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.AssignTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IAssignTree=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.AssignTree} AssignTree instance
                     */
                    AssignTree.create = function create(properties) {
                        return new AssignTree(properties);
                    };

                    /**
                     * Encodes the specified AssignTree message. Does not implicitly {@link scala.meta.internal.semanticdb.AssignTree.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.AssignTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IAssignTree} message AssignTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    AssignTree.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.lhs != null && Object.hasOwnProperty.call(message, "lhs"))
                            $root.scala.meta.internal.semanticdb.Tree.encode(message.lhs, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.rhs != null && Object.hasOwnProperty.call(message, "rhs"))
                            $root.scala.meta.internal.semanticdb.Tree.encode(message.rhs, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified AssignTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.AssignTree.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.AssignTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IAssignTree} message AssignTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    AssignTree.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an AssignTree message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.AssignTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.AssignTree} AssignTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    AssignTree.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.AssignTree();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.lhs = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.rhs = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an AssignTree message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.AssignTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.AssignTree} AssignTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    AssignTree.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an AssignTree message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.AssignTree
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    AssignTree.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.lhs != null && message.hasOwnProperty("lhs")) {
                            let error = $root.scala.meta.internal.semanticdb.Tree.verify(message.lhs);
                            if (error)
                                return "lhs." + error;
                        }
                        if (message.rhs != null && message.hasOwnProperty("rhs")) {
                            let error = $root.scala.meta.internal.semanticdb.Tree.verify(message.rhs);
                            if (error)
                                return "rhs." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates an AssignTree message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.AssignTree
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.AssignTree} AssignTree
                     */
                    AssignTree.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.AssignTree)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.AssignTree();
                        if (object.lhs != null) {
                            if (typeof object.lhs !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.AssignTree.lhs: object expected");
                            message.lhs = $root.scala.meta.internal.semanticdb.Tree.fromObject(object.lhs);
                        }
                        if (object.rhs != null) {
                            if (typeof object.rhs !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.AssignTree.rhs: object expected");
                            message.rhs = $root.scala.meta.internal.semanticdb.Tree.fromObject(object.rhs);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from an AssignTree message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.AssignTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.AssignTree} message AssignTree
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    AssignTree.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.lhs = null;
                            object.rhs = null;
                        }
                        if (message.lhs != null && message.hasOwnProperty("lhs"))
                            object.lhs = $root.scala.meta.internal.semanticdb.Tree.toObject(message.lhs, options);
                        if (message.rhs != null && message.hasOwnProperty("rhs"))
                            object.rhs = $root.scala.meta.internal.semanticdb.Tree.toObject(message.rhs, options);
                        return object;
                    };

                    /**
                     * Converts this AssignTree to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.AssignTree
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    AssignTree.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for AssignTree
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.AssignTree
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    AssignTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.AssignTree";
                    };

                    return AssignTree;
                })();

                semanticdb.Access = (function() {

                    /**
                     * Properties of an Access.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IAccess
                     * @property {scala.meta.internal.semanticdb.IPrivateAccess|null} [privateAccess] Access privateAccess
                     * @property {scala.meta.internal.semanticdb.IPrivateThisAccess|null} [privateThisAccess] Access privateThisAccess
                     * @property {scala.meta.internal.semanticdb.IPrivateWithinAccess|null} [privateWithinAccess] Access privateWithinAccess
                     * @property {scala.meta.internal.semanticdb.IProtectedAccess|null} [protectedAccess] Access protectedAccess
                     * @property {scala.meta.internal.semanticdb.IProtectedThisAccess|null} [protectedThisAccess] Access protectedThisAccess
                     * @property {scala.meta.internal.semanticdb.IProtectedWithinAccess|null} [protectedWithinAccess] Access protectedWithinAccess
                     * @property {scala.meta.internal.semanticdb.IPublicAccess|null} [publicAccess] Access publicAccess
                     */

                    /**
                     * Constructs a new Access.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an Access.
                     * @implements IAccess
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IAccess=} [properties] Properties to set
                     */
                    function Access(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Access privateAccess.
                     * @member {scala.meta.internal.semanticdb.IPrivateAccess|null|undefined} privateAccess
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @instance
                     */
                    Access.prototype.privateAccess = null;

                    /**
                     * Access privateThisAccess.
                     * @member {scala.meta.internal.semanticdb.IPrivateThisAccess|null|undefined} privateThisAccess
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @instance
                     */
                    Access.prototype.privateThisAccess = null;

                    /**
                     * Access privateWithinAccess.
                     * @member {scala.meta.internal.semanticdb.IPrivateWithinAccess|null|undefined} privateWithinAccess
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @instance
                     */
                    Access.prototype.privateWithinAccess = null;

                    /**
                     * Access protectedAccess.
                     * @member {scala.meta.internal.semanticdb.IProtectedAccess|null|undefined} protectedAccess
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @instance
                     */
                    Access.prototype.protectedAccess = null;

                    /**
                     * Access protectedThisAccess.
                     * @member {scala.meta.internal.semanticdb.IProtectedThisAccess|null|undefined} protectedThisAccess
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @instance
                     */
                    Access.prototype.protectedThisAccess = null;

                    /**
                     * Access protectedWithinAccess.
                     * @member {scala.meta.internal.semanticdb.IProtectedWithinAccess|null|undefined} protectedWithinAccess
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @instance
                     */
                    Access.prototype.protectedWithinAccess = null;

                    /**
                     * Access publicAccess.
                     * @member {scala.meta.internal.semanticdb.IPublicAccess|null|undefined} publicAccess
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @instance
                     */
                    Access.prototype.publicAccess = null;

                    // OneOf field names bound to virtual getters and setters
                    let $oneOfFields;

                    /**
                     * Access sealedValue.
                     * @member {"privateAccess"|"privateThisAccess"|"privateWithinAccess"|"protectedAccess"|"protectedThisAccess"|"protectedWithinAccess"|"publicAccess"|undefined} sealedValue
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @instance
                     */
                    Object.defineProperty(Access.prototype, "sealedValue", {
                        get: $util.oneOfGetter($oneOfFields = ["privateAccess", "privateThisAccess", "privateWithinAccess", "protectedAccess", "protectedThisAccess", "protectedWithinAccess", "publicAccess"]),
                        set: $util.oneOfSetter($oneOfFields)
                    });

                    /**
                     * Creates a new Access instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @static
                     * @param {scala.meta.internal.semanticdb.IAccess=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.Access} Access instance
                     */
                    Access.create = function create(properties) {
                        return new Access(properties);
                    };

                    /**
                     * Encodes the specified Access message. Does not implicitly {@link scala.meta.internal.semanticdb.Access.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @static
                     * @param {scala.meta.internal.semanticdb.IAccess} message Access message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Access.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.privateAccess != null && Object.hasOwnProperty.call(message, "privateAccess"))
                            $root.scala.meta.internal.semanticdb.PrivateAccess.encode(message.privateAccess, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.privateThisAccess != null && Object.hasOwnProperty.call(message, "privateThisAccess"))
                            $root.scala.meta.internal.semanticdb.PrivateThisAccess.encode(message.privateThisAccess, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.privateWithinAccess != null && Object.hasOwnProperty.call(message, "privateWithinAccess"))
                            $root.scala.meta.internal.semanticdb.PrivateWithinAccess.encode(message.privateWithinAccess, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        if (message.protectedAccess != null && Object.hasOwnProperty.call(message, "protectedAccess"))
                            $root.scala.meta.internal.semanticdb.ProtectedAccess.encode(message.protectedAccess, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
                        if (message.protectedThisAccess != null && Object.hasOwnProperty.call(message, "protectedThisAccess"))
                            $root.scala.meta.internal.semanticdb.ProtectedThisAccess.encode(message.protectedThisAccess, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
                        if (message.protectedWithinAccess != null && Object.hasOwnProperty.call(message, "protectedWithinAccess"))
                            $root.scala.meta.internal.semanticdb.ProtectedWithinAccess.encode(message.protectedWithinAccess, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
                        if (message.publicAccess != null && Object.hasOwnProperty.call(message, "publicAccess"))
                            $root.scala.meta.internal.semanticdb.PublicAccess.encode(message.publicAccess, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified Access message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Access.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @static
                     * @param {scala.meta.internal.semanticdb.IAccess} message Access message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Access.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an Access message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.Access} Access
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Access.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Access();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.privateAccess = $root.scala.meta.internal.semanticdb.PrivateAccess.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.privateThisAccess = $root.scala.meta.internal.semanticdb.PrivateThisAccess.decode(reader, reader.uint32());
                                    break;
                                }
                            case 3: {
                                    message.privateWithinAccess = $root.scala.meta.internal.semanticdb.PrivateWithinAccess.decode(reader, reader.uint32());
                                    break;
                                }
                            case 4: {
                                    message.protectedAccess = $root.scala.meta.internal.semanticdb.ProtectedAccess.decode(reader, reader.uint32());
                                    break;
                                }
                            case 5: {
                                    message.protectedThisAccess = $root.scala.meta.internal.semanticdb.ProtectedThisAccess.decode(reader, reader.uint32());
                                    break;
                                }
                            case 6: {
                                    message.protectedWithinAccess = $root.scala.meta.internal.semanticdb.ProtectedWithinAccess.decode(reader, reader.uint32());
                                    break;
                                }
                            case 7: {
                                    message.publicAccess = $root.scala.meta.internal.semanticdb.PublicAccess.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an Access message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.Access} Access
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Access.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an Access message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Access.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        let properties = {};
                        if (message.privateAccess != null && message.hasOwnProperty("privateAccess")) {
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.PrivateAccess.verify(message.privateAccess);
                                if (error)
                                    return "privateAccess." + error;
                            }
                        }
                        if (message.privateThisAccess != null && message.hasOwnProperty("privateThisAccess")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.PrivateThisAccess.verify(message.privateThisAccess);
                                if (error)
                                    return "privateThisAccess." + error;
                            }
                        }
                        if (message.privateWithinAccess != null && message.hasOwnProperty("privateWithinAccess")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.PrivateWithinAccess.verify(message.privateWithinAccess);
                                if (error)
                                    return "privateWithinAccess." + error;
                            }
                        }
                        if (message.protectedAccess != null && message.hasOwnProperty("protectedAccess")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.ProtectedAccess.verify(message.protectedAccess);
                                if (error)
                                    return "protectedAccess." + error;
                            }
                        }
                        if (message.protectedThisAccess != null && message.hasOwnProperty("protectedThisAccess")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.ProtectedThisAccess.verify(message.protectedThisAccess);
                                if (error)
                                    return "protectedThisAccess." + error;
                            }
                        }
                        if (message.protectedWithinAccess != null && message.hasOwnProperty("protectedWithinAccess")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.ProtectedWithinAccess.verify(message.protectedWithinAccess);
                                if (error)
                                    return "protectedWithinAccess." + error;
                            }
                        }
                        if (message.publicAccess != null && message.hasOwnProperty("publicAccess")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.PublicAccess.verify(message.publicAccess);
                                if (error)
                                    return "publicAccess." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates an Access message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.Access} Access
                     */
                    Access.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.Access)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.Access();
                        if (object.privateAccess != null) {
                            if (typeof object.privateAccess !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Access.privateAccess: object expected");
                            message.privateAccess = $root.scala.meta.internal.semanticdb.PrivateAccess.fromObject(object.privateAccess);
                        }
                        if (object.privateThisAccess != null) {
                            if (typeof object.privateThisAccess !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Access.privateThisAccess: object expected");
                            message.privateThisAccess = $root.scala.meta.internal.semanticdb.PrivateThisAccess.fromObject(object.privateThisAccess);
                        }
                        if (object.privateWithinAccess != null) {
                            if (typeof object.privateWithinAccess !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Access.privateWithinAccess: object expected");
                            message.privateWithinAccess = $root.scala.meta.internal.semanticdb.PrivateWithinAccess.fromObject(object.privateWithinAccess);
                        }
                        if (object.protectedAccess != null) {
                            if (typeof object.protectedAccess !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Access.protectedAccess: object expected");
                            message.protectedAccess = $root.scala.meta.internal.semanticdb.ProtectedAccess.fromObject(object.protectedAccess);
                        }
                        if (object.protectedThisAccess != null) {
                            if (typeof object.protectedThisAccess !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Access.protectedThisAccess: object expected");
                            message.protectedThisAccess = $root.scala.meta.internal.semanticdb.ProtectedThisAccess.fromObject(object.protectedThisAccess);
                        }
                        if (object.protectedWithinAccess != null) {
                            if (typeof object.protectedWithinAccess !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Access.protectedWithinAccess: object expected");
                            message.protectedWithinAccess = $root.scala.meta.internal.semanticdb.ProtectedWithinAccess.fromObject(object.protectedWithinAccess);
                        }
                        if (object.publicAccess != null) {
                            if (typeof object.publicAccess !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Access.publicAccess: object expected");
                            message.publicAccess = $root.scala.meta.internal.semanticdb.PublicAccess.fromObject(object.publicAccess);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from an Access message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @static
                     * @param {scala.meta.internal.semanticdb.Access} message Access
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Access.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (message.privateAccess != null && message.hasOwnProperty("privateAccess")) {
                            object.privateAccess = $root.scala.meta.internal.semanticdb.PrivateAccess.toObject(message.privateAccess, options);
                            if (options.oneofs)
                                object.sealedValue = "privateAccess";
                        }
                        if (message.privateThisAccess != null && message.hasOwnProperty("privateThisAccess")) {
                            object.privateThisAccess = $root.scala.meta.internal.semanticdb.PrivateThisAccess.toObject(message.privateThisAccess, options);
                            if (options.oneofs)
                                object.sealedValue = "privateThisAccess";
                        }
                        if (message.privateWithinAccess != null && message.hasOwnProperty("privateWithinAccess")) {
                            object.privateWithinAccess = $root.scala.meta.internal.semanticdb.PrivateWithinAccess.toObject(message.privateWithinAccess, options);
                            if (options.oneofs)
                                object.sealedValue = "privateWithinAccess";
                        }
                        if (message.protectedAccess != null && message.hasOwnProperty("protectedAccess")) {
                            object.protectedAccess = $root.scala.meta.internal.semanticdb.ProtectedAccess.toObject(message.protectedAccess, options);
                            if (options.oneofs)
                                object.sealedValue = "protectedAccess";
                        }
                        if (message.protectedThisAccess != null && message.hasOwnProperty("protectedThisAccess")) {
                            object.protectedThisAccess = $root.scala.meta.internal.semanticdb.ProtectedThisAccess.toObject(message.protectedThisAccess, options);
                            if (options.oneofs)
                                object.sealedValue = "protectedThisAccess";
                        }
                        if (message.protectedWithinAccess != null && message.hasOwnProperty("protectedWithinAccess")) {
                            object.protectedWithinAccess = $root.scala.meta.internal.semanticdb.ProtectedWithinAccess.toObject(message.protectedWithinAccess, options);
                            if (options.oneofs)
                                object.sealedValue = "protectedWithinAccess";
                        }
                        if (message.publicAccess != null && message.hasOwnProperty("publicAccess")) {
                            object.publicAccess = $root.scala.meta.internal.semanticdb.PublicAccess.toObject(message.publicAccess, options);
                            if (options.oneofs)
                                object.sealedValue = "publicAccess";
                        }
                        return object;
                    };

                    /**
                     * Converts this Access to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Access.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Access
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.Access
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Access.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.Access";
                    };

                    return Access;
                })();

                semanticdb.PrivateAccess = (function() {

                    /**
                     * Properties of a PrivateAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IPrivateAccess
                     */

                    /**
                     * Constructs a new PrivateAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a PrivateAccess.
                     * @implements IPrivateAccess
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IPrivateAccess=} [properties] Properties to set
                     */
                    function PrivateAccess(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Creates a new PrivateAccess instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.PrivateAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IPrivateAccess=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.PrivateAccess} PrivateAccess instance
                     */
                    PrivateAccess.create = function create(properties) {
                        return new PrivateAccess(properties);
                    };

                    /**
                     * Encodes the specified PrivateAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.PrivateAccess.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.PrivateAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IPrivateAccess} message PrivateAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PrivateAccess.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        return writer;
                    };

                    /**
                     * Encodes the specified PrivateAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.PrivateAccess.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.PrivateAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IPrivateAccess} message PrivateAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PrivateAccess.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a PrivateAccess message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.PrivateAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.PrivateAccess} PrivateAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PrivateAccess.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.PrivateAccess();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a PrivateAccess message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.PrivateAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.PrivateAccess} PrivateAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PrivateAccess.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a PrivateAccess message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.PrivateAccess
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    PrivateAccess.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        return null;
                    };

                    /**
                     * Creates a PrivateAccess message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.PrivateAccess
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.PrivateAccess} PrivateAccess
                     */
                    PrivateAccess.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.PrivateAccess)
                            return object;
                        return new $root.scala.meta.internal.semanticdb.PrivateAccess();
                    };

                    /**
                     * Creates a plain object from a PrivateAccess message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.PrivateAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.PrivateAccess} message PrivateAccess
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    PrivateAccess.toObject = function toObject() {
                        return {};
                    };

                    /**
                     * Converts this PrivateAccess to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.PrivateAccess
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    PrivateAccess.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for PrivateAccess
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.PrivateAccess
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    PrivateAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.PrivateAccess";
                    };

                    return PrivateAccess;
                })();

                semanticdb.PrivateThisAccess = (function() {

                    /**
                     * Properties of a PrivateThisAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IPrivateThisAccess
                     */

                    /**
                     * Constructs a new PrivateThisAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a PrivateThisAccess.
                     * @implements IPrivateThisAccess
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IPrivateThisAccess=} [properties] Properties to set
                     */
                    function PrivateThisAccess(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Creates a new PrivateThisAccess instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.PrivateThisAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IPrivateThisAccess=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.PrivateThisAccess} PrivateThisAccess instance
                     */
                    PrivateThisAccess.create = function create(properties) {
                        return new PrivateThisAccess(properties);
                    };

                    /**
                     * Encodes the specified PrivateThisAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.PrivateThisAccess.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.PrivateThisAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IPrivateThisAccess} message PrivateThisAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PrivateThisAccess.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        return writer;
                    };

                    /**
                     * Encodes the specified PrivateThisAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.PrivateThisAccess.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.PrivateThisAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IPrivateThisAccess} message PrivateThisAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PrivateThisAccess.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a PrivateThisAccess message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.PrivateThisAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.PrivateThisAccess} PrivateThisAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PrivateThisAccess.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.PrivateThisAccess();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a PrivateThisAccess message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.PrivateThisAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.PrivateThisAccess} PrivateThisAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PrivateThisAccess.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a PrivateThisAccess message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.PrivateThisAccess
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    PrivateThisAccess.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        return null;
                    };

                    /**
                     * Creates a PrivateThisAccess message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.PrivateThisAccess
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.PrivateThisAccess} PrivateThisAccess
                     */
                    PrivateThisAccess.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.PrivateThisAccess)
                            return object;
                        return new $root.scala.meta.internal.semanticdb.PrivateThisAccess();
                    };

                    /**
                     * Creates a plain object from a PrivateThisAccess message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.PrivateThisAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.PrivateThisAccess} message PrivateThisAccess
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    PrivateThisAccess.toObject = function toObject() {
                        return {};
                    };

                    /**
                     * Converts this PrivateThisAccess to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.PrivateThisAccess
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    PrivateThisAccess.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for PrivateThisAccess
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.PrivateThisAccess
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    PrivateThisAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.PrivateThisAccess";
                    };

                    return PrivateThisAccess;
                })();

                semanticdb.PrivateWithinAccess = (function() {

                    /**
                     * Properties of a PrivateWithinAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IPrivateWithinAccess
                     * @property {string|null} [symbol] PrivateWithinAccess symbol
                     */

                    /**
                     * Constructs a new PrivateWithinAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a PrivateWithinAccess.
                     * @implements IPrivateWithinAccess
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IPrivateWithinAccess=} [properties] Properties to set
                     */
                    function PrivateWithinAccess(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * PrivateWithinAccess symbol.
                     * @member {string} symbol
                     * @memberof scala.meta.internal.semanticdb.PrivateWithinAccess
                     * @instance
                     */
                    PrivateWithinAccess.prototype.symbol = "";

                    /**
                     * Creates a new PrivateWithinAccess instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.PrivateWithinAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IPrivateWithinAccess=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.PrivateWithinAccess} PrivateWithinAccess instance
                     */
                    PrivateWithinAccess.create = function create(properties) {
                        return new PrivateWithinAccess(properties);
                    };

                    /**
                     * Encodes the specified PrivateWithinAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.PrivateWithinAccess.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.PrivateWithinAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IPrivateWithinAccess} message PrivateWithinAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PrivateWithinAccess.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.symbol);
                        return writer;
                    };

                    /**
                     * Encodes the specified PrivateWithinAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.PrivateWithinAccess.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.PrivateWithinAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IPrivateWithinAccess} message PrivateWithinAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PrivateWithinAccess.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a PrivateWithinAccess message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.PrivateWithinAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.PrivateWithinAccess} PrivateWithinAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PrivateWithinAccess.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.PrivateWithinAccess();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.symbol = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a PrivateWithinAccess message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.PrivateWithinAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.PrivateWithinAccess} PrivateWithinAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PrivateWithinAccess.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a PrivateWithinAccess message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.PrivateWithinAccess
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    PrivateWithinAccess.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            if (!$util.isString(message.symbol))
                                return "symbol: string expected";
                        return null;
                    };

                    /**
                     * Creates a PrivateWithinAccess message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.PrivateWithinAccess
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.PrivateWithinAccess} PrivateWithinAccess
                     */
                    PrivateWithinAccess.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.PrivateWithinAccess)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.PrivateWithinAccess();
                        if (object.symbol != null)
                            message.symbol = String(object.symbol);
                        return message;
                    };

                    /**
                     * Creates a plain object from a PrivateWithinAccess message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.PrivateWithinAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.PrivateWithinAccess} message PrivateWithinAccess
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    PrivateWithinAccess.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.symbol = "";
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            object.symbol = message.symbol;
                        return object;
                    };

                    /**
                     * Converts this PrivateWithinAccess to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.PrivateWithinAccess
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    PrivateWithinAccess.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for PrivateWithinAccess
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.PrivateWithinAccess
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    PrivateWithinAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.PrivateWithinAccess";
                    };

                    return PrivateWithinAccess;
                })();

                semanticdb.ProtectedAccess = (function() {

                    /**
                     * Properties of a ProtectedAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IProtectedAccess
                     */

                    /**
                     * Constructs a new ProtectedAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a ProtectedAccess.
                     * @implements IProtectedAccess
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IProtectedAccess=} [properties] Properties to set
                     */
                    function ProtectedAccess(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Creates a new ProtectedAccess instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.ProtectedAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IProtectedAccess=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.ProtectedAccess} ProtectedAccess instance
                     */
                    ProtectedAccess.create = function create(properties) {
                        return new ProtectedAccess(properties);
                    };

                    /**
                     * Encodes the specified ProtectedAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.ProtectedAccess.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.ProtectedAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IProtectedAccess} message ProtectedAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ProtectedAccess.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        return writer;
                    };

                    /**
                     * Encodes the specified ProtectedAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ProtectedAccess.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ProtectedAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IProtectedAccess} message ProtectedAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ProtectedAccess.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ProtectedAccess message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.ProtectedAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.ProtectedAccess} ProtectedAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ProtectedAccess.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ProtectedAccess();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ProtectedAccess message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ProtectedAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.ProtectedAccess} ProtectedAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ProtectedAccess.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ProtectedAccess message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.ProtectedAccess
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ProtectedAccess.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        return null;
                    };

                    /**
                     * Creates a ProtectedAccess message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.ProtectedAccess
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.ProtectedAccess} ProtectedAccess
                     */
                    ProtectedAccess.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.ProtectedAccess)
                            return object;
                        return new $root.scala.meta.internal.semanticdb.ProtectedAccess();
                    };

                    /**
                     * Creates a plain object from a ProtectedAccess message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.ProtectedAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.ProtectedAccess} message ProtectedAccess
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ProtectedAccess.toObject = function toObject() {
                        return {};
                    };

                    /**
                     * Converts this ProtectedAccess to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.ProtectedAccess
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ProtectedAccess.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ProtectedAccess
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.ProtectedAccess
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ProtectedAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.ProtectedAccess";
                    };

                    return ProtectedAccess;
                })();

                semanticdb.ProtectedThisAccess = (function() {

                    /**
                     * Properties of a ProtectedThisAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IProtectedThisAccess
                     */

                    /**
                     * Constructs a new ProtectedThisAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a ProtectedThisAccess.
                     * @implements IProtectedThisAccess
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IProtectedThisAccess=} [properties] Properties to set
                     */
                    function ProtectedThisAccess(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Creates a new ProtectedThisAccess instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.ProtectedThisAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IProtectedThisAccess=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.ProtectedThisAccess} ProtectedThisAccess instance
                     */
                    ProtectedThisAccess.create = function create(properties) {
                        return new ProtectedThisAccess(properties);
                    };

                    /**
                     * Encodes the specified ProtectedThisAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.ProtectedThisAccess.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.ProtectedThisAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IProtectedThisAccess} message ProtectedThisAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ProtectedThisAccess.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        return writer;
                    };

                    /**
                     * Encodes the specified ProtectedThisAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ProtectedThisAccess.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ProtectedThisAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IProtectedThisAccess} message ProtectedThisAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ProtectedThisAccess.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ProtectedThisAccess message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.ProtectedThisAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.ProtectedThisAccess} ProtectedThisAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ProtectedThisAccess.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ProtectedThisAccess();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ProtectedThisAccess message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ProtectedThisAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.ProtectedThisAccess} ProtectedThisAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ProtectedThisAccess.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ProtectedThisAccess message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.ProtectedThisAccess
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ProtectedThisAccess.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        return null;
                    };

                    /**
                     * Creates a ProtectedThisAccess message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.ProtectedThisAccess
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.ProtectedThisAccess} ProtectedThisAccess
                     */
                    ProtectedThisAccess.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.ProtectedThisAccess)
                            return object;
                        return new $root.scala.meta.internal.semanticdb.ProtectedThisAccess();
                    };

                    /**
                     * Creates a plain object from a ProtectedThisAccess message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.ProtectedThisAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.ProtectedThisAccess} message ProtectedThisAccess
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ProtectedThisAccess.toObject = function toObject() {
                        return {};
                    };

                    /**
                     * Converts this ProtectedThisAccess to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.ProtectedThisAccess
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ProtectedThisAccess.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ProtectedThisAccess
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.ProtectedThisAccess
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ProtectedThisAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.ProtectedThisAccess";
                    };

                    return ProtectedThisAccess;
                })();

                semanticdb.ProtectedWithinAccess = (function() {

                    /**
                     * Properties of a ProtectedWithinAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IProtectedWithinAccess
                     * @property {string|null} [symbol] ProtectedWithinAccess symbol
                     */

                    /**
                     * Constructs a new ProtectedWithinAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a ProtectedWithinAccess.
                     * @implements IProtectedWithinAccess
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IProtectedWithinAccess=} [properties] Properties to set
                     */
                    function ProtectedWithinAccess(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ProtectedWithinAccess symbol.
                     * @member {string} symbol
                     * @memberof scala.meta.internal.semanticdb.ProtectedWithinAccess
                     * @instance
                     */
                    ProtectedWithinAccess.prototype.symbol = "";

                    /**
                     * Creates a new ProtectedWithinAccess instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.ProtectedWithinAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IProtectedWithinAccess=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.ProtectedWithinAccess} ProtectedWithinAccess instance
                     */
                    ProtectedWithinAccess.create = function create(properties) {
                        return new ProtectedWithinAccess(properties);
                    };

                    /**
                     * Encodes the specified ProtectedWithinAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.ProtectedWithinAccess.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.ProtectedWithinAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IProtectedWithinAccess} message ProtectedWithinAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ProtectedWithinAccess.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.symbol);
                        return writer;
                    };

                    /**
                     * Encodes the specified ProtectedWithinAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ProtectedWithinAccess.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ProtectedWithinAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IProtectedWithinAccess} message ProtectedWithinAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ProtectedWithinAccess.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a ProtectedWithinAccess message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.ProtectedWithinAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.ProtectedWithinAccess} ProtectedWithinAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ProtectedWithinAccess.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ProtectedWithinAccess();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.symbol = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a ProtectedWithinAccess message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ProtectedWithinAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.ProtectedWithinAccess} ProtectedWithinAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ProtectedWithinAccess.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a ProtectedWithinAccess message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.ProtectedWithinAccess
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ProtectedWithinAccess.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            if (!$util.isString(message.symbol))
                                return "symbol: string expected";
                        return null;
                    };

                    /**
                     * Creates a ProtectedWithinAccess message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.ProtectedWithinAccess
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.ProtectedWithinAccess} ProtectedWithinAccess
                     */
                    ProtectedWithinAccess.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.ProtectedWithinAccess)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.ProtectedWithinAccess();
                        if (object.symbol != null)
                            message.symbol = String(object.symbol);
                        return message;
                    };

                    /**
                     * Creates a plain object from a ProtectedWithinAccess message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.ProtectedWithinAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.ProtectedWithinAccess} message ProtectedWithinAccess
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ProtectedWithinAccess.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.symbol = "";
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            object.symbol = message.symbol;
                        return object;
                    };

                    /**
                     * Converts this ProtectedWithinAccess to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.ProtectedWithinAccess
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ProtectedWithinAccess.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ProtectedWithinAccess
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.ProtectedWithinAccess
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ProtectedWithinAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.ProtectedWithinAccess";
                    };

                    return ProtectedWithinAccess;
                })();

                semanticdb.PublicAccess = (function() {

                    /**
                     * Properties of a PublicAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IPublicAccess
                     */

                    /**
                     * Constructs a new PublicAccess.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a PublicAccess.
                     * @implements IPublicAccess
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IPublicAccess=} [properties] Properties to set
                     */
                    function PublicAccess(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Creates a new PublicAccess instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.PublicAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IPublicAccess=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.PublicAccess} PublicAccess instance
                     */
                    PublicAccess.create = function create(properties) {
                        return new PublicAccess(properties);
                    };

                    /**
                     * Encodes the specified PublicAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.PublicAccess.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.PublicAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IPublicAccess} message PublicAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PublicAccess.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        return writer;
                    };

                    /**
                     * Encodes the specified PublicAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.PublicAccess.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.PublicAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.IPublicAccess} message PublicAccess message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    PublicAccess.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a PublicAccess message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.PublicAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.PublicAccess} PublicAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PublicAccess.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.PublicAccess();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a PublicAccess message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.PublicAccess
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.PublicAccess} PublicAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    PublicAccess.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a PublicAccess message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.PublicAccess
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    PublicAccess.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        return null;
                    };

                    /**
                     * Creates a PublicAccess message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.PublicAccess
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.PublicAccess} PublicAccess
                     */
                    PublicAccess.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.PublicAccess)
                            return object;
                        return new $root.scala.meta.internal.semanticdb.PublicAccess();
                    };

                    /**
                     * Creates a plain object from a PublicAccess message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.PublicAccess
                     * @static
                     * @param {scala.meta.internal.semanticdb.PublicAccess} message PublicAccess
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    PublicAccess.toObject = function toObject() {
                        return {};
                    };

                    /**
                     * Converts this PublicAccess to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.PublicAccess
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    PublicAccess.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for PublicAccess
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.PublicAccess
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    PublicAccess.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.PublicAccess";
                    };

                    return PublicAccess;
                })();

                semanticdb.SymbolOccurrence = (function() {

                    /**
                     * Properties of a SymbolOccurrence.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ISymbolOccurrence
                     * @property {scala.meta.internal.semanticdb.IRange|null} [range] SymbolOccurrence range
                     * @property {string|null} [symbol] SymbolOccurrence symbol
                     * @property {scala.meta.internal.semanticdb.SymbolOccurrence.Role|null} [role] SymbolOccurrence role
                     */

                    /**
                     * Constructs a new SymbolOccurrence.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a SymbolOccurrence.
                     * @implements ISymbolOccurrence
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ISymbolOccurrence=} [properties] Properties to set
                     */
                    function SymbolOccurrence(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * SymbolOccurrence range.
                     * @member {scala.meta.internal.semanticdb.IRange|null|undefined} range
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @instance
                     */
                    SymbolOccurrence.prototype.range = null;

                    /**
                     * SymbolOccurrence symbol.
                     * @member {string} symbol
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @instance
                     */
                    SymbolOccurrence.prototype.symbol = "";

                    /**
                     * SymbolOccurrence role.
                     * @member {scala.meta.internal.semanticdb.SymbolOccurrence.Role} role
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @instance
                     */
                    SymbolOccurrence.prototype.role = 0;

                    /**
                     * Creates a new SymbolOccurrence instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISymbolOccurrence=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.SymbolOccurrence} SymbolOccurrence instance
                     */
                    SymbolOccurrence.create = function create(properties) {
                        return new SymbolOccurrence(properties);
                    };

                    /**
                     * Encodes the specified SymbolOccurrence message. Does not implicitly {@link scala.meta.internal.semanticdb.SymbolOccurrence.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISymbolOccurrence} message SymbolOccurrence message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    SymbolOccurrence.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.range != null && Object.hasOwnProperty.call(message, "range"))
                            $root.scala.meta.internal.semanticdb.Range.encode(message.range, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
                            writer.uint32(/* id 2, wireType 2 =*/18).string(message.symbol);
                        if (message.role != null && Object.hasOwnProperty.call(message, "role"))
                            writer.uint32(/* id 3, wireType 0 =*/24).int32(message.role);
                        return writer;
                    };

                    /**
                     * Encodes the specified SymbolOccurrence message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.SymbolOccurrence.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISymbolOccurrence} message SymbolOccurrence message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    SymbolOccurrence.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a SymbolOccurrence message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.SymbolOccurrence} SymbolOccurrence
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    SymbolOccurrence.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.SymbolOccurrence();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.range = $root.scala.meta.internal.semanticdb.Range.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.symbol = reader.string();
                                    break;
                                }
                            case 3: {
                                    message.role = reader.int32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a SymbolOccurrence message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.SymbolOccurrence} SymbolOccurrence
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    SymbolOccurrence.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a SymbolOccurrence message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    SymbolOccurrence.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.range != null && message.hasOwnProperty("range")) {
                            let error = $root.scala.meta.internal.semanticdb.Range.verify(message.range);
                            if (error)
                                return "range." + error;
                        }
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            if (!$util.isString(message.symbol))
                                return "symbol: string expected";
                        if (message.role != null && message.hasOwnProperty("role"))
                            switch (message.role) {
                            default:
                                return "role: enum value expected";
                            case 0:
                            case 1:
                            case 2:
                                break;
                            }
                        return null;
                    };

                    /**
                     * Creates a SymbolOccurrence message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.SymbolOccurrence} SymbolOccurrence
                     */
                    SymbolOccurrence.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.SymbolOccurrence)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.SymbolOccurrence();
                        if (object.range != null) {
                            if (typeof object.range !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.SymbolOccurrence.range: object expected");
                            message.range = $root.scala.meta.internal.semanticdb.Range.fromObject(object.range);
                        }
                        if (object.symbol != null)
                            message.symbol = String(object.symbol);
                        switch (object.role) {
                        default:
                            if (typeof object.role === "number") {
                                message.role = object.role;
                                break;
                            }
                            break;
                        case "UNKNOWN_ROLE":
                        case 0:
                            message.role = 0;
                            break;
                        case "REFERENCE":
                        case 1:
                            message.role = 1;
                            break;
                        case "DEFINITION":
                        case 2:
                            message.role = 2;
                            break;
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a SymbolOccurrence message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @static
                     * @param {scala.meta.internal.semanticdb.SymbolOccurrence} message SymbolOccurrence
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    SymbolOccurrence.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.range = null;
                            object.symbol = "";
                            object.role = options.enums === String ? "UNKNOWN_ROLE" : 0;
                        }
                        if (message.range != null && message.hasOwnProperty("range"))
                            object.range = $root.scala.meta.internal.semanticdb.Range.toObject(message.range, options);
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            object.symbol = message.symbol;
                        if (message.role != null && message.hasOwnProperty("role"))
                            object.role = options.enums === String ? $root.scala.meta.internal.semanticdb.SymbolOccurrence.Role[message.role] === undefined ? message.role : $root.scala.meta.internal.semanticdb.SymbolOccurrence.Role[message.role] : message.role;
                        return object;
                    };

                    /**
                     * Converts this SymbolOccurrence to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    SymbolOccurrence.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for SymbolOccurrence
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.SymbolOccurrence
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    SymbolOccurrence.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.SymbolOccurrence";
                    };

                    /**
                     * Role enum.
                     * @name scala.meta.internal.semanticdb.SymbolOccurrence.Role
                     * @enum {number}
                     * @property {number} UNKNOWN_ROLE=0 UNKNOWN_ROLE value
                     * @property {number} REFERENCE=1 REFERENCE value
                     * @property {number} DEFINITION=2 DEFINITION value
                     */
                    SymbolOccurrence.Role = (function() {
                        const valuesById = {}, values = Object.create(valuesById);
                        values[valuesById[0] = "UNKNOWN_ROLE"] = 0;
                        values[valuesById[1] = "REFERENCE"] = 1;
                        values[valuesById[2] = "DEFINITION"] = 2;
                        return values;
                    })();

                    return SymbolOccurrence;
                })();

                semanticdb.Diagnostic = (function() {

                    /**
                     * Properties of a Diagnostic.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IDiagnostic
                     * @property {scala.meta.internal.semanticdb.IRange|null} [range] Diagnostic range
                     * @property {scala.meta.internal.semanticdb.Diagnostic.Severity|null} [severity] Diagnostic severity
                     * @property {string|null} [message] Diagnostic message
                     */

                    /**
                     * Constructs a new Diagnostic.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a Diagnostic.
                     * @implements IDiagnostic
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IDiagnostic=} [properties] Properties to set
                     */
                    function Diagnostic(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Diagnostic range.
                     * @member {scala.meta.internal.semanticdb.IRange|null|undefined} range
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @instance
                     */
                    Diagnostic.prototype.range = null;

                    /**
                     * Diagnostic severity.
                     * @member {scala.meta.internal.semanticdb.Diagnostic.Severity} severity
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @instance
                     */
                    Diagnostic.prototype.severity = 0;

                    /**
                     * Diagnostic message.
                     * @member {string} message
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @instance
                     */
                    Diagnostic.prototype.message = "";

                    /**
                     * Creates a new Diagnostic instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @static
                     * @param {scala.meta.internal.semanticdb.IDiagnostic=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.Diagnostic} Diagnostic instance
                     */
                    Diagnostic.create = function create(properties) {
                        return new Diagnostic(properties);
                    };

                    /**
                     * Encodes the specified Diagnostic message. Does not implicitly {@link scala.meta.internal.semanticdb.Diagnostic.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @static
                     * @param {scala.meta.internal.semanticdb.IDiagnostic} message Diagnostic message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Diagnostic.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.range != null && Object.hasOwnProperty.call(message, "range"))
                            $root.scala.meta.internal.semanticdb.Range.encode(message.range, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.severity != null && Object.hasOwnProperty.call(message, "severity"))
                            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.severity);
                        if (message.message != null && Object.hasOwnProperty.call(message, "message"))
                            writer.uint32(/* id 3, wireType 2 =*/26).string(message.message);
                        return writer;
                    };

                    /**
                     * Encodes the specified Diagnostic message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Diagnostic.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @static
                     * @param {scala.meta.internal.semanticdb.IDiagnostic} message Diagnostic message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Diagnostic.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Diagnostic message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.Diagnostic} Diagnostic
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Diagnostic.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Diagnostic();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.range = $root.scala.meta.internal.semanticdb.Range.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.severity = reader.int32();
                                    break;
                                }
                            case 3: {
                                    message.message = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Diagnostic message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.Diagnostic} Diagnostic
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Diagnostic.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Diagnostic message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Diagnostic.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.range != null && message.hasOwnProperty("range")) {
                            let error = $root.scala.meta.internal.semanticdb.Range.verify(message.range);
                            if (error)
                                return "range." + error;
                        }
                        if (message.severity != null && message.hasOwnProperty("severity"))
                            switch (message.severity) {
                            default:
                                return "severity: enum value expected";
                            case 0:
                            case 1:
                            case 2:
                            case 3:
                            case 4:
                                break;
                            }
                        if (message.message != null && message.hasOwnProperty("message"))
                            if (!$util.isString(message.message))
                                return "message: string expected";
                        return null;
                    };

                    /**
                     * Creates a Diagnostic message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.Diagnostic} Diagnostic
                     */
                    Diagnostic.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.Diagnostic)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.Diagnostic();
                        if (object.range != null) {
                            if (typeof object.range !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Diagnostic.range: object expected");
                            message.range = $root.scala.meta.internal.semanticdb.Range.fromObject(object.range);
                        }
                        switch (object.severity) {
                        default:
                            if (typeof object.severity === "number") {
                                message.severity = object.severity;
                                break;
                            }
                            break;
                        case "UNKNOWN_SEVERITY":
                        case 0:
                            message.severity = 0;
                            break;
                        case "ERROR":
                        case 1:
                            message.severity = 1;
                            break;
                        case "WARNING":
                        case 2:
                            message.severity = 2;
                            break;
                        case "INFORMATION":
                        case 3:
                            message.severity = 3;
                            break;
                        case "HINT":
                        case 4:
                            message.severity = 4;
                            break;
                        }
                        if (object.message != null)
                            message.message = String(object.message);
                        return message;
                    };

                    /**
                     * Creates a plain object from a Diagnostic message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @static
                     * @param {scala.meta.internal.semanticdb.Diagnostic} message Diagnostic
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Diagnostic.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.range = null;
                            object.severity = options.enums === String ? "UNKNOWN_SEVERITY" : 0;
                            object.message = "";
                        }
                        if (message.range != null && message.hasOwnProperty("range"))
                            object.range = $root.scala.meta.internal.semanticdb.Range.toObject(message.range, options);
                        if (message.severity != null && message.hasOwnProperty("severity"))
                            object.severity = options.enums === String ? $root.scala.meta.internal.semanticdb.Diagnostic.Severity[message.severity] === undefined ? message.severity : $root.scala.meta.internal.semanticdb.Diagnostic.Severity[message.severity] : message.severity;
                        if (message.message != null && message.hasOwnProperty("message"))
                            object.message = message.message;
                        return object;
                    };

                    /**
                     * Converts this Diagnostic to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Diagnostic.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Diagnostic
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.Diagnostic
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Diagnostic.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.Diagnostic";
                    };

                    /**
                     * Severity enum.
                     * @name scala.meta.internal.semanticdb.Diagnostic.Severity
                     * @enum {number}
                     * @property {number} UNKNOWN_SEVERITY=0 UNKNOWN_SEVERITY value
                     * @property {number} ERROR=1 ERROR value
                     * @property {number} WARNING=2 WARNING value
                     * @property {number} INFORMATION=3 INFORMATION value
                     * @property {number} HINT=4 HINT value
                     */
                    Diagnostic.Severity = (function() {
                        const valuesById = {}, values = Object.create(valuesById);
                        values[valuesById[0] = "UNKNOWN_SEVERITY"] = 0;
                        values[valuesById[1] = "ERROR"] = 1;
                        values[valuesById[2] = "WARNING"] = 2;
                        values[valuesById[3] = "INFORMATION"] = 3;
                        values[valuesById[4] = "HINT"] = 4;
                        return values;
                    })();

                    return Diagnostic;
                })();

                semanticdb.Synthetic = (function() {

                    /**
                     * Properties of a Synthetic.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ISynthetic
                     * @property {scala.meta.internal.semanticdb.IRange|null} [range] Synthetic range
                     * @property {scala.meta.internal.semanticdb.ITree|null} [tree] Synthetic tree
                     */

                    /**
                     * Constructs a new Synthetic.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a Synthetic.
                     * @implements ISynthetic
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ISynthetic=} [properties] Properties to set
                     */
                    function Synthetic(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Synthetic range.
                     * @member {scala.meta.internal.semanticdb.IRange|null|undefined} range
                     * @memberof scala.meta.internal.semanticdb.Synthetic
                     * @instance
                     */
                    Synthetic.prototype.range = null;

                    /**
                     * Synthetic tree.
                     * @member {scala.meta.internal.semanticdb.ITree|null|undefined} tree
                     * @memberof scala.meta.internal.semanticdb.Synthetic
                     * @instance
                     */
                    Synthetic.prototype.tree = null;

                    /**
                     * Creates a new Synthetic instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.Synthetic
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISynthetic=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.Synthetic} Synthetic instance
                     */
                    Synthetic.create = function create(properties) {
                        return new Synthetic(properties);
                    };

                    /**
                     * Encodes the specified Synthetic message. Does not implicitly {@link scala.meta.internal.semanticdb.Synthetic.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.Synthetic
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISynthetic} message Synthetic message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Synthetic.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.range != null && Object.hasOwnProperty.call(message, "range"))
                            $root.scala.meta.internal.semanticdb.Range.encode(message.range, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.tree != null && Object.hasOwnProperty.call(message, "tree"))
                            $root.scala.meta.internal.semanticdb.Tree.encode(message.tree, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified Synthetic message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Synthetic.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Synthetic
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISynthetic} message Synthetic message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Synthetic.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Synthetic message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.Synthetic
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.Synthetic} Synthetic
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Synthetic.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Synthetic();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.range = $root.scala.meta.internal.semanticdb.Range.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.tree = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Synthetic message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Synthetic
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.Synthetic} Synthetic
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Synthetic.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Synthetic message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.Synthetic
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Synthetic.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.range != null && message.hasOwnProperty("range")) {
                            let error = $root.scala.meta.internal.semanticdb.Range.verify(message.range);
                            if (error)
                                return "range." + error;
                        }
                        if (message.tree != null && message.hasOwnProperty("tree")) {
                            let error = $root.scala.meta.internal.semanticdb.Tree.verify(message.tree);
                            if (error)
                                return "tree." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a Synthetic message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.Synthetic
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.Synthetic} Synthetic
                     */
                    Synthetic.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.Synthetic)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.Synthetic();
                        if (object.range != null) {
                            if (typeof object.range !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Synthetic.range: object expected");
                            message.range = $root.scala.meta.internal.semanticdb.Range.fromObject(object.range);
                        }
                        if (object.tree != null) {
                            if (typeof object.tree !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Synthetic.tree: object expected");
                            message.tree = $root.scala.meta.internal.semanticdb.Tree.fromObject(object.tree);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a Synthetic message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.Synthetic
                     * @static
                     * @param {scala.meta.internal.semanticdb.Synthetic} message Synthetic
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Synthetic.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.range = null;
                            object.tree = null;
                        }
                        if (message.range != null && message.hasOwnProperty("range"))
                            object.range = $root.scala.meta.internal.semanticdb.Range.toObject(message.range, options);
                        if (message.tree != null && message.hasOwnProperty("tree"))
                            object.tree = $root.scala.meta.internal.semanticdb.Tree.toObject(message.tree, options);
                        return object;
                    };

                    /**
                     * Converts this Synthetic to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.Synthetic
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Synthetic.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Synthetic
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.Synthetic
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Synthetic.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.Synthetic";
                    };

                    return Synthetic;
                })();

                semanticdb.Tree = (function() {

                    /**
                     * Properties of a Tree.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ITree
                     * @property {scala.meta.internal.semanticdb.IApplyTree|null} [applyTree] Tree applyTree
                     * @property {scala.meta.internal.semanticdb.IFunctionTree|null} [functionTree] Tree functionTree
                     * @property {scala.meta.internal.semanticdb.IIdTree|null} [idTree] Tree idTree
                     * @property {scala.meta.internal.semanticdb.ILiteralTree|null} [literalTree] Tree literalTree
                     * @property {scala.meta.internal.semanticdb.IMacroExpansionTree|null} [macroExpansionTree] Tree macroExpansionTree
                     * @property {scala.meta.internal.semanticdb.IOriginalTree|null} [originalTree] Tree originalTree
                     * @property {scala.meta.internal.semanticdb.ISelectTree|null} [selectTree] Tree selectTree
                     * @property {scala.meta.internal.semanticdb.ITypeApplyTree|null} [typeApplyTree] Tree typeApplyTree
                     * @property {scala.meta.internal.semanticdb.IAssignTree|null} [assignTree] Tree assignTree
                     * @property {scala.meta.internal.semanticdb.IAnnotationTree|null} [annotationTree] Tree annotationTree
                     */

                    /**
                     * Constructs a new Tree.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a Tree.
                     * @implements ITree
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ITree=} [properties] Properties to set
                     */
                    function Tree(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * Tree applyTree.
                     * @member {scala.meta.internal.semanticdb.IApplyTree|null|undefined} applyTree
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @instance
                     */
                    Tree.prototype.applyTree = null;

                    /**
                     * Tree functionTree.
                     * @member {scala.meta.internal.semanticdb.IFunctionTree|null|undefined} functionTree
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @instance
                     */
                    Tree.prototype.functionTree = null;

                    /**
                     * Tree idTree.
                     * @member {scala.meta.internal.semanticdb.IIdTree|null|undefined} idTree
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @instance
                     */
                    Tree.prototype.idTree = null;

                    /**
                     * Tree literalTree.
                     * @member {scala.meta.internal.semanticdb.ILiteralTree|null|undefined} literalTree
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @instance
                     */
                    Tree.prototype.literalTree = null;

                    /**
                     * Tree macroExpansionTree.
                     * @member {scala.meta.internal.semanticdb.IMacroExpansionTree|null|undefined} macroExpansionTree
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @instance
                     */
                    Tree.prototype.macroExpansionTree = null;

                    /**
                     * Tree originalTree.
                     * @member {scala.meta.internal.semanticdb.IOriginalTree|null|undefined} originalTree
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @instance
                     */
                    Tree.prototype.originalTree = null;

                    /**
                     * Tree selectTree.
                     * @member {scala.meta.internal.semanticdb.ISelectTree|null|undefined} selectTree
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @instance
                     */
                    Tree.prototype.selectTree = null;

                    /**
                     * Tree typeApplyTree.
                     * @member {scala.meta.internal.semanticdb.ITypeApplyTree|null|undefined} typeApplyTree
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @instance
                     */
                    Tree.prototype.typeApplyTree = null;

                    /**
                     * Tree assignTree.
                     * @member {scala.meta.internal.semanticdb.IAssignTree|null|undefined} assignTree
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @instance
                     */
                    Tree.prototype.assignTree = null;

                    /**
                     * Tree annotationTree.
                     * @member {scala.meta.internal.semanticdb.IAnnotationTree|null|undefined} annotationTree
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @instance
                     */
                    Tree.prototype.annotationTree = null;

                    // OneOf field names bound to virtual getters and setters
                    let $oneOfFields;

                    /**
                     * Tree sealedValue.
                     * @member {"applyTree"|"functionTree"|"idTree"|"literalTree"|"macroExpansionTree"|"originalTree"|"selectTree"|"typeApplyTree"|"assignTree"|"annotationTree"|undefined} sealedValue
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @instance
                     */
                    Object.defineProperty(Tree.prototype, "sealedValue", {
                        get: $util.oneOfGetter($oneOfFields = ["applyTree", "functionTree", "idTree", "literalTree", "macroExpansionTree", "originalTree", "selectTree", "typeApplyTree", "assignTree", "annotationTree"]),
                        set: $util.oneOfSetter($oneOfFields)
                    });

                    /**
                     * Creates a new Tree instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITree=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.Tree} Tree instance
                     */
                    Tree.create = function create(properties) {
                        return new Tree(properties);
                    };

                    /**
                     * Encodes the specified Tree message. Does not implicitly {@link scala.meta.internal.semanticdb.Tree.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITree} message Tree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Tree.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.applyTree != null && Object.hasOwnProperty.call(message, "applyTree"))
                            $root.scala.meta.internal.semanticdb.ApplyTree.encode(message.applyTree, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.functionTree != null && Object.hasOwnProperty.call(message, "functionTree"))
                            $root.scala.meta.internal.semanticdb.FunctionTree.encode(message.functionTree, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.idTree != null && Object.hasOwnProperty.call(message, "idTree"))
                            $root.scala.meta.internal.semanticdb.IdTree.encode(message.idTree, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                        if (message.literalTree != null && Object.hasOwnProperty.call(message, "literalTree"))
                            $root.scala.meta.internal.semanticdb.LiteralTree.encode(message.literalTree, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
                        if (message.macroExpansionTree != null && Object.hasOwnProperty.call(message, "macroExpansionTree"))
                            $root.scala.meta.internal.semanticdb.MacroExpansionTree.encode(message.macroExpansionTree, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
                        if (message.originalTree != null && Object.hasOwnProperty.call(message, "originalTree"))
                            $root.scala.meta.internal.semanticdb.OriginalTree.encode(message.originalTree, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
                        if (message.selectTree != null && Object.hasOwnProperty.call(message, "selectTree"))
                            $root.scala.meta.internal.semanticdb.SelectTree.encode(message.selectTree, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
                        if (message.typeApplyTree != null && Object.hasOwnProperty.call(message, "typeApplyTree"))
                            $root.scala.meta.internal.semanticdb.TypeApplyTree.encode(message.typeApplyTree, writer.uint32(/* id 8, wireType 2 =*/66).fork()).ldelim();
                        if (message.assignTree != null && Object.hasOwnProperty.call(message, "assignTree"))
                            $root.scala.meta.internal.semanticdb.AssignTree.encode(message.assignTree, writer.uint32(/* id 9, wireType 2 =*/74).fork()).ldelim();
                        if (message.annotationTree != null && Object.hasOwnProperty.call(message, "annotationTree"))
                            $root.scala.meta.internal.semanticdb.AnnotationTree.encode(message.annotationTree, writer.uint32(/* id 10, wireType 2 =*/82).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified Tree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Tree.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITree} message Tree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    Tree.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a Tree message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.Tree} Tree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Tree.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.Tree();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.applyTree = $root.scala.meta.internal.semanticdb.ApplyTree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.functionTree = $root.scala.meta.internal.semanticdb.FunctionTree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 3: {
                                    message.idTree = $root.scala.meta.internal.semanticdb.IdTree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 4: {
                                    message.literalTree = $root.scala.meta.internal.semanticdb.LiteralTree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 5: {
                                    message.macroExpansionTree = $root.scala.meta.internal.semanticdb.MacroExpansionTree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 6: {
                                    message.originalTree = $root.scala.meta.internal.semanticdb.OriginalTree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 7: {
                                    message.selectTree = $root.scala.meta.internal.semanticdb.SelectTree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 8: {
                                    message.typeApplyTree = $root.scala.meta.internal.semanticdb.TypeApplyTree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 9: {
                                    message.assignTree = $root.scala.meta.internal.semanticdb.AssignTree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 10: {
                                    message.annotationTree = $root.scala.meta.internal.semanticdb.AnnotationTree.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a Tree message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.Tree} Tree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    Tree.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a Tree message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    Tree.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        let properties = {};
                        if (message.applyTree != null && message.hasOwnProperty("applyTree")) {
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.ApplyTree.verify(message.applyTree);
                                if (error)
                                    return "applyTree." + error;
                            }
                        }
                        if (message.functionTree != null && message.hasOwnProperty("functionTree")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.FunctionTree.verify(message.functionTree);
                                if (error)
                                    return "functionTree." + error;
                            }
                        }
                        if (message.idTree != null && message.hasOwnProperty("idTree")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.IdTree.verify(message.idTree);
                                if (error)
                                    return "idTree." + error;
                            }
                        }
                        if (message.literalTree != null && message.hasOwnProperty("literalTree")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.LiteralTree.verify(message.literalTree);
                                if (error)
                                    return "literalTree." + error;
                            }
                        }
                        if (message.macroExpansionTree != null && message.hasOwnProperty("macroExpansionTree")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.MacroExpansionTree.verify(message.macroExpansionTree);
                                if (error)
                                    return "macroExpansionTree." + error;
                            }
                        }
                        if (message.originalTree != null && message.hasOwnProperty("originalTree")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.OriginalTree.verify(message.originalTree);
                                if (error)
                                    return "originalTree." + error;
                            }
                        }
                        if (message.selectTree != null && message.hasOwnProperty("selectTree")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.SelectTree.verify(message.selectTree);
                                if (error)
                                    return "selectTree." + error;
                            }
                        }
                        if (message.typeApplyTree != null && message.hasOwnProperty("typeApplyTree")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.TypeApplyTree.verify(message.typeApplyTree);
                                if (error)
                                    return "typeApplyTree." + error;
                            }
                        }
                        if (message.assignTree != null && message.hasOwnProperty("assignTree")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.AssignTree.verify(message.assignTree);
                                if (error)
                                    return "assignTree." + error;
                            }
                        }
                        if (message.annotationTree != null && message.hasOwnProperty("annotationTree")) {
                            if (properties.sealedValue === 1)
                                return "sealedValue: multiple values";
                            properties.sealedValue = 1;
                            {
                                let error = $root.scala.meta.internal.semanticdb.AnnotationTree.verify(message.annotationTree);
                                if (error)
                                    return "annotationTree." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates a Tree message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.Tree} Tree
                     */
                    Tree.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.Tree)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.Tree();
                        if (object.applyTree != null) {
                            if (typeof object.applyTree !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Tree.applyTree: object expected");
                            message.applyTree = $root.scala.meta.internal.semanticdb.ApplyTree.fromObject(object.applyTree);
                        }
                        if (object.functionTree != null) {
                            if (typeof object.functionTree !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Tree.functionTree: object expected");
                            message.functionTree = $root.scala.meta.internal.semanticdb.FunctionTree.fromObject(object.functionTree);
                        }
                        if (object.idTree != null) {
                            if (typeof object.idTree !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Tree.idTree: object expected");
                            message.idTree = $root.scala.meta.internal.semanticdb.IdTree.fromObject(object.idTree);
                        }
                        if (object.literalTree != null) {
                            if (typeof object.literalTree !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Tree.literalTree: object expected");
                            message.literalTree = $root.scala.meta.internal.semanticdb.LiteralTree.fromObject(object.literalTree);
                        }
                        if (object.macroExpansionTree != null) {
                            if (typeof object.macroExpansionTree !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Tree.macroExpansionTree: object expected");
                            message.macroExpansionTree = $root.scala.meta.internal.semanticdb.MacroExpansionTree.fromObject(object.macroExpansionTree);
                        }
                        if (object.originalTree != null) {
                            if (typeof object.originalTree !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Tree.originalTree: object expected");
                            message.originalTree = $root.scala.meta.internal.semanticdb.OriginalTree.fromObject(object.originalTree);
                        }
                        if (object.selectTree != null) {
                            if (typeof object.selectTree !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Tree.selectTree: object expected");
                            message.selectTree = $root.scala.meta.internal.semanticdb.SelectTree.fromObject(object.selectTree);
                        }
                        if (object.typeApplyTree != null) {
                            if (typeof object.typeApplyTree !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Tree.typeApplyTree: object expected");
                            message.typeApplyTree = $root.scala.meta.internal.semanticdb.TypeApplyTree.fromObject(object.typeApplyTree);
                        }
                        if (object.assignTree != null) {
                            if (typeof object.assignTree !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Tree.assignTree: object expected");
                            message.assignTree = $root.scala.meta.internal.semanticdb.AssignTree.fromObject(object.assignTree);
                        }
                        if (object.annotationTree != null) {
                            if (typeof object.annotationTree !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.Tree.annotationTree: object expected");
                            message.annotationTree = $root.scala.meta.internal.semanticdb.AnnotationTree.fromObject(object.annotationTree);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a Tree message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @static
                     * @param {scala.meta.internal.semanticdb.Tree} message Tree
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    Tree.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (message.applyTree != null && message.hasOwnProperty("applyTree")) {
                            object.applyTree = $root.scala.meta.internal.semanticdb.ApplyTree.toObject(message.applyTree, options);
                            if (options.oneofs)
                                object.sealedValue = "applyTree";
                        }
                        if (message.functionTree != null && message.hasOwnProperty("functionTree")) {
                            object.functionTree = $root.scala.meta.internal.semanticdb.FunctionTree.toObject(message.functionTree, options);
                            if (options.oneofs)
                                object.sealedValue = "functionTree";
                        }
                        if (message.idTree != null && message.hasOwnProperty("idTree")) {
                            object.idTree = $root.scala.meta.internal.semanticdb.IdTree.toObject(message.idTree, options);
                            if (options.oneofs)
                                object.sealedValue = "idTree";
                        }
                        if (message.literalTree != null && message.hasOwnProperty("literalTree")) {
                            object.literalTree = $root.scala.meta.internal.semanticdb.LiteralTree.toObject(message.literalTree, options);
                            if (options.oneofs)
                                object.sealedValue = "literalTree";
                        }
                        if (message.macroExpansionTree != null && message.hasOwnProperty("macroExpansionTree")) {
                            object.macroExpansionTree = $root.scala.meta.internal.semanticdb.MacroExpansionTree.toObject(message.macroExpansionTree, options);
                            if (options.oneofs)
                                object.sealedValue = "macroExpansionTree";
                        }
                        if (message.originalTree != null && message.hasOwnProperty("originalTree")) {
                            object.originalTree = $root.scala.meta.internal.semanticdb.OriginalTree.toObject(message.originalTree, options);
                            if (options.oneofs)
                                object.sealedValue = "originalTree";
                        }
                        if (message.selectTree != null && message.hasOwnProperty("selectTree")) {
                            object.selectTree = $root.scala.meta.internal.semanticdb.SelectTree.toObject(message.selectTree, options);
                            if (options.oneofs)
                                object.sealedValue = "selectTree";
                        }
                        if (message.typeApplyTree != null && message.hasOwnProperty("typeApplyTree")) {
                            object.typeApplyTree = $root.scala.meta.internal.semanticdb.TypeApplyTree.toObject(message.typeApplyTree, options);
                            if (options.oneofs)
                                object.sealedValue = "typeApplyTree";
                        }
                        if (message.assignTree != null && message.hasOwnProperty("assignTree")) {
                            object.assignTree = $root.scala.meta.internal.semanticdb.AssignTree.toObject(message.assignTree, options);
                            if (options.oneofs)
                                object.sealedValue = "assignTree";
                        }
                        if (message.annotationTree != null && message.hasOwnProperty("annotationTree")) {
                            object.annotationTree = $root.scala.meta.internal.semanticdb.AnnotationTree.toObject(message.annotationTree, options);
                            if (options.oneofs)
                                object.sealedValue = "annotationTree";
                        }
                        return object;
                    };

                    /**
                     * Converts this Tree to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    Tree.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for Tree
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.Tree
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    Tree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.Tree";
                    };

                    return Tree;
                })();

                semanticdb.ApplyTree = (function() {

                    /**
                     * Properties of an ApplyTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IApplyTree
                     * @property {scala.meta.internal.semanticdb.ITree|null} ["function"] ApplyTree function
                     * @property {Array.<scala.meta.internal.semanticdb.ITree>|null} ["arguments"] ApplyTree arguments
                     * @property {number|null} [properties] ApplyTree properties
                     */

                    /**
                     * Constructs a new ApplyTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an ApplyTree.
                     * @implements IApplyTree
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IApplyTree=} [properties] Properties to set
                     */
                    function ApplyTree(properties) {
                        this["arguments"] = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * ApplyTree function.
                     * @member {scala.meta.internal.semanticdb.ITree|null|undefined} function
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @instance
                     */
                    ApplyTree.prototype["function"] = null;

                    /**
                     * ApplyTree arguments.
                     * @member {Array.<scala.meta.internal.semanticdb.ITree>} arguments
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @instance
                     */
                    ApplyTree.prototype["arguments"] = $util.emptyArray;

                    /**
                     * ApplyTree properties.
                     * @member {number} properties
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @instance
                     */
                    ApplyTree.prototype.properties = 0;

                    /**
                     * Creates a new ApplyTree instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IApplyTree=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.ApplyTree} ApplyTree instance
                     */
                    ApplyTree.create = function create(properties) {
                        return new ApplyTree(properties);
                    };

                    /**
                     * Encodes the specified ApplyTree message. Does not implicitly {@link scala.meta.internal.semanticdb.ApplyTree.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IApplyTree} message ApplyTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ApplyTree.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message["function"] != null && Object.hasOwnProperty.call(message, "function"))
                            $root.scala.meta.internal.semanticdb.Tree.encode(message["function"], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message["arguments"] != null && message["arguments"].length)
                            for (let i = 0; i < message["arguments"].length; ++i)
                                $root.scala.meta.internal.semanticdb.Tree.encode(message["arguments"][i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        if (message.properties != null && Object.hasOwnProperty.call(message, "properties"))
                            writer.uint32(/* id 3, wireType 0 =*/24).int32(message.properties);
                        return writer;
                    };

                    /**
                     * Encodes the specified ApplyTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ApplyTree.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IApplyTree} message ApplyTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    ApplyTree.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an ApplyTree message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.ApplyTree} ApplyTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ApplyTree.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.ApplyTree();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message["function"] = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    if (!(message["arguments"] && message["arguments"].length))
                                        message["arguments"] = [];
                                    message["arguments"].push($root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32()));
                                    break;
                                }
                            case 3: {
                                    message.properties = reader.int32();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an ApplyTree message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.ApplyTree} ApplyTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    ApplyTree.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an ApplyTree message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    ApplyTree.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message["function"] != null && message.hasOwnProperty("function")) {
                            let error = $root.scala.meta.internal.semanticdb.Tree.verify(message["function"]);
                            if (error)
                                return "function." + error;
                        }
                        if (message["arguments"] != null && message.hasOwnProperty("arguments")) {
                            if (!Array.isArray(message["arguments"]))
                                return "arguments: array expected";
                            for (let i = 0; i < message["arguments"].length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.Tree.verify(message["arguments"][i]);
                                if (error)
                                    return "arguments." + error;
                            }
                        }
                        if (message.properties != null && message.hasOwnProperty("properties"))
                            if (!$util.isInteger(message.properties))
                                return "properties: integer expected";
                        return null;
                    };

                    /**
                     * Creates an ApplyTree message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.ApplyTree} ApplyTree
                     */
                    ApplyTree.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.ApplyTree)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.ApplyTree();
                        if (object["function"] != null) {
                            if (typeof object["function"] !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.ApplyTree.function: object expected");
                            message["function"] = $root.scala.meta.internal.semanticdb.Tree.fromObject(object["function"]);
                        }
                        if (object["arguments"]) {
                            if (!Array.isArray(object["arguments"]))
                                throw TypeError(".scala.meta.internal.semanticdb.ApplyTree.arguments: array expected");
                            message["arguments"] = [];
                            for (let i = 0; i < object["arguments"].length; ++i) {
                                if (typeof object["arguments"][i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.ApplyTree.arguments: object expected");
                                message["arguments"][i] = $root.scala.meta.internal.semanticdb.Tree.fromObject(object["arguments"][i]);
                            }
                        }
                        if (object.properties != null)
                            message.properties = object.properties | 0;
                        return message;
                    };

                    /**
                     * Creates a plain object from an ApplyTree message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ApplyTree} message ApplyTree
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    ApplyTree.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object["arguments"] = [];
                        if (options.defaults) {
                            object["function"] = null;
                            object.properties = 0;
                        }
                        if (message["function"] != null && message.hasOwnProperty("function"))
                            object["function"] = $root.scala.meta.internal.semanticdb.Tree.toObject(message["function"], options);
                        if (message["arguments"] && message["arguments"].length) {
                            object["arguments"] = [];
                            for (let j = 0; j < message["arguments"].length; ++j)
                                object["arguments"][j] = $root.scala.meta.internal.semanticdb.Tree.toObject(message["arguments"][j], options);
                        }
                        if (message.properties != null && message.hasOwnProperty("properties"))
                            object.properties = message.properties;
                        return object;
                    };

                    /**
                     * Converts this ApplyTree to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    ApplyTree.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for ApplyTree
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.ApplyTree
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    ApplyTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.ApplyTree";
                    };

                    return ApplyTree;
                })();

                semanticdb.FunctionTree = (function() {

                    /**
                     * Properties of a FunctionTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IFunctionTree
                     * @property {Array.<scala.meta.internal.semanticdb.IIdTree>|null} [parameters] FunctionTree parameters
                     * @property {scala.meta.internal.semanticdb.ITree|null} [body] FunctionTree body
                     */

                    /**
                     * Constructs a new FunctionTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a FunctionTree.
                     * @implements IFunctionTree
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IFunctionTree=} [properties] Properties to set
                     */
                    function FunctionTree(properties) {
                        this.parameters = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * FunctionTree parameters.
                     * @member {Array.<scala.meta.internal.semanticdb.IIdTree>} parameters
                     * @memberof scala.meta.internal.semanticdb.FunctionTree
                     * @instance
                     */
                    FunctionTree.prototype.parameters = $util.emptyArray;

                    /**
                     * FunctionTree body.
                     * @member {scala.meta.internal.semanticdb.ITree|null|undefined} body
                     * @memberof scala.meta.internal.semanticdb.FunctionTree
                     * @instance
                     */
                    FunctionTree.prototype.body = null;

                    /**
                     * Creates a new FunctionTree instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.FunctionTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IFunctionTree=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.FunctionTree} FunctionTree instance
                     */
                    FunctionTree.create = function create(properties) {
                        return new FunctionTree(properties);
                    };

                    /**
                     * Encodes the specified FunctionTree message. Does not implicitly {@link scala.meta.internal.semanticdb.FunctionTree.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.FunctionTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IFunctionTree} message FunctionTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FunctionTree.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.parameters != null && message.parameters.length)
                            for (let i = 0; i < message.parameters.length; ++i)
                                $root.scala.meta.internal.semanticdb.IdTree.encode(message.parameters[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.body != null && Object.hasOwnProperty.call(message, "body"))
                            $root.scala.meta.internal.semanticdb.Tree.encode(message.body, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified FunctionTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.FunctionTree.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.FunctionTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IFunctionTree} message FunctionTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    FunctionTree.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a FunctionTree message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.FunctionTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.FunctionTree} FunctionTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FunctionTree.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.FunctionTree();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    if (!(message.parameters && message.parameters.length))
                                        message.parameters = [];
                                    message.parameters.push($root.scala.meta.internal.semanticdb.IdTree.decode(reader, reader.uint32()));
                                    break;
                                }
                            case 2: {
                                    message.body = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a FunctionTree message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.FunctionTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.FunctionTree} FunctionTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    FunctionTree.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a FunctionTree message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.FunctionTree
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    FunctionTree.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.parameters != null && message.hasOwnProperty("parameters")) {
                            if (!Array.isArray(message.parameters))
                                return "parameters: array expected";
                            for (let i = 0; i < message.parameters.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.IdTree.verify(message.parameters[i]);
                                if (error)
                                    return "parameters." + error;
                            }
                        }
                        if (message.body != null && message.hasOwnProperty("body")) {
                            let error = $root.scala.meta.internal.semanticdb.Tree.verify(message.body);
                            if (error)
                                return "body." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a FunctionTree message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.FunctionTree
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.FunctionTree} FunctionTree
                     */
                    FunctionTree.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.FunctionTree)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.FunctionTree();
                        if (object.parameters) {
                            if (!Array.isArray(object.parameters))
                                throw TypeError(".scala.meta.internal.semanticdb.FunctionTree.parameters: array expected");
                            message.parameters = [];
                            for (let i = 0; i < object.parameters.length; ++i) {
                                if (typeof object.parameters[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.FunctionTree.parameters: object expected");
                                message.parameters[i] = $root.scala.meta.internal.semanticdb.IdTree.fromObject(object.parameters[i]);
                            }
                        }
                        if (object.body != null) {
                            if (typeof object.body !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.FunctionTree.body: object expected");
                            message.body = $root.scala.meta.internal.semanticdb.Tree.fromObject(object.body);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a FunctionTree message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.FunctionTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.FunctionTree} message FunctionTree
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    FunctionTree.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.parameters = [];
                        if (options.defaults)
                            object.body = null;
                        if (message.parameters && message.parameters.length) {
                            object.parameters = [];
                            for (let j = 0; j < message.parameters.length; ++j)
                                object.parameters[j] = $root.scala.meta.internal.semanticdb.IdTree.toObject(message.parameters[j], options);
                        }
                        if (message.body != null && message.hasOwnProperty("body"))
                            object.body = $root.scala.meta.internal.semanticdb.Tree.toObject(message.body, options);
                        return object;
                    };

                    /**
                     * Converts this FunctionTree to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.FunctionTree
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    FunctionTree.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for FunctionTree
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.FunctionTree
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    FunctionTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.FunctionTree";
                    };

                    return FunctionTree;
                })();

                semanticdb.IdTree = (function() {

                    /**
                     * Properties of an IdTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IIdTree
                     * @property {string|null} [symbol] IdTree symbol
                     */

                    /**
                     * Constructs a new IdTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an IdTree.
                     * @implements IIdTree
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IIdTree=} [properties] Properties to set
                     */
                    function IdTree(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * IdTree symbol.
                     * @member {string} symbol
                     * @memberof scala.meta.internal.semanticdb.IdTree
                     * @instance
                     */
                    IdTree.prototype.symbol = "";

                    /**
                     * Creates a new IdTree instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.IdTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IIdTree=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.IdTree} IdTree instance
                     */
                    IdTree.create = function create(properties) {
                        return new IdTree(properties);
                    };

                    /**
                     * Encodes the specified IdTree message. Does not implicitly {@link scala.meta.internal.semanticdb.IdTree.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.IdTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IIdTree} message IdTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    IdTree.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.symbol != null && Object.hasOwnProperty.call(message, "symbol"))
                            writer.uint32(/* id 1, wireType 2 =*/10).string(message.symbol);
                        return writer;
                    };

                    /**
                     * Encodes the specified IdTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.IdTree.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.IdTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IIdTree} message IdTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    IdTree.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an IdTree message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.IdTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.IdTree} IdTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    IdTree.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.IdTree();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.symbol = reader.string();
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an IdTree message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.IdTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.IdTree} IdTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    IdTree.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an IdTree message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.IdTree
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    IdTree.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            if (!$util.isString(message.symbol))
                                return "symbol: string expected";
                        return null;
                    };

                    /**
                     * Creates an IdTree message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.IdTree
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.IdTree} IdTree
                     */
                    IdTree.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.IdTree)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.IdTree();
                        if (object.symbol != null)
                            message.symbol = String(object.symbol);
                        return message;
                    };

                    /**
                     * Creates a plain object from an IdTree message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.IdTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IdTree} message IdTree
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    IdTree.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.symbol = "";
                        if (message.symbol != null && message.hasOwnProperty("symbol"))
                            object.symbol = message.symbol;
                        return object;
                    };

                    /**
                     * Converts this IdTree to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.IdTree
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    IdTree.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for IdTree
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.IdTree
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    IdTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.IdTree";
                    };

                    return IdTree;
                })();

                semanticdb.LiteralTree = (function() {

                    /**
                     * Properties of a LiteralTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ILiteralTree
                     * @property {scala.meta.internal.semanticdb.IConstant|null} [constant] LiteralTree constant
                     */

                    /**
                     * Constructs a new LiteralTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a LiteralTree.
                     * @implements ILiteralTree
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ILiteralTree=} [properties] Properties to set
                     */
                    function LiteralTree(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * LiteralTree constant.
                     * @member {scala.meta.internal.semanticdb.IConstant|null|undefined} constant
                     * @memberof scala.meta.internal.semanticdb.LiteralTree
                     * @instance
                     */
                    LiteralTree.prototype.constant = null;

                    /**
                     * Creates a new LiteralTree instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.LiteralTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ILiteralTree=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.LiteralTree} LiteralTree instance
                     */
                    LiteralTree.create = function create(properties) {
                        return new LiteralTree(properties);
                    };

                    /**
                     * Encodes the specified LiteralTree message. Does not implicitly {@link scala.meta.internal.semanticdb.LiteralTree.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.LiteralTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ILiteralTree} message LiteralTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    LiteralTree.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.constant != null && Object.hasOwnProperty.call(message, "constant"))
                            $root.scala.meta.internal.semanticdb.Constant.encode(message.constant, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified LiteralTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.LiteralTree.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.LiteralTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ILiteralTree} message LiteralTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    LiteralTree.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a LiteralTree message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.LiteralTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.LiteralTree} LiteralTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    LiteralTree.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.LiteralTree();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.constant = $root.scala.meta.internal.semanticdb.Constant.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a LiteralTree message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.LiteralTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.LiteralTree} LiteralTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    LiteralTree.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a LiteralTree message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.LiteralTree
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    LiteralTree.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.constant != null && message.hasOwnProperty("constant")) {
                            let error = $root.scala.meta.internal.semanticdb.Constant.verify(message.constant);
                            if (error)
                                return "constant." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a LiteralTree message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.LiteralTree
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.LiteralTree} LiteralTree
                     */
                    LiteralTree.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.LiteralTree)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.LiteralTree();
                        if (object.constant != null) {
                            if (typeof object.constant !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.LiteralTree.constant: object expected");
                            message.constant = $root.scala.meta.internal.semanticdb.Constant.fromObject(object.constant);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a LiteralTree message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.LiteralTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.LiteralTree} message LiteralTree
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    LiteralTree.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.constant = null;
                        if (message.constant != null && message.hasOwnProperty("constant"))
                            object.constant = $root.scala.meta.internal.semanticdb.Constant.toObject(message.constant, options);
                        return object;
                    };

                    /**
                     * Converts this LiteralTree to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.LiteralTree
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    LiteralTree.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for LiteralTree
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.LiteralTree
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    LiteralTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.LiteralTree";
                    };

                    return LiteralTree;
                })();

                semanticdb.MacroExpansionTree = (function() {

                    /**
                     * Properties of a MacroExpansionTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IMacroExpansionTree
                     * @property {scala.meta.internal.semanticdb.ITree|null} [beforeExpansion] MacroExpansionTree beforeExpansion
                     * @property {scala.meta.internal.semanticdb.IType|null} [tpe] MacroExpansionTree tpe
                     */

                    /**
                     * Constructs a new MacroExpansionTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a MacroExpansionTree.
                     * @implements IMacroExpansionTree
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IMacroExpansionTree=} [properties] Properties to set
                     */
                    function MacroExpansionTree(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * MacroExpansionTree beforeExpansion.
                     * @member {scala.meta.internal.semanticdb.ITree|null|undefined} beforeExpansion
                     * @memberof scala.meta.internal.semanticdb.MacroExpansionTree
                     * @instance
                     */
                    MacroExpansionTree.prototype.beforeExpansion = null;

                    /**
                     * MacroExpansionTree tpe.
                     * @member {scala.meta.internal.semanticdb.IType|null|undefined} tpe
                     * @memberof scala.meta.internal.semanticdb.MacroExpansionTree
                     * @instance
                     */
                    MacroExpansionTree.prototype.tpe = null;

                    /**
                     * Creates a new MacroExpansionTree instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.MacroExpansionTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IMacroExpansionTree=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.MacroExpansionTree} MacroExpansionTree instance
                     */
                    MacroExpansionTree.create = function create(properties) {
                        return new MacroExpansionTree(properties);
                    };

                    /**
                     * Encodes the specified MacroExpansionTree message. Does not implicitly {@link scala.meta.internal.semanticdb.MacroExpansionTree.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.MacroExpansionTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IMacroExpansionTree} message MacroExpansionTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    MacroExpansionTree.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.beforeExpansion != null && Object.hasOwnProperty.call(message, "beforeExpansion"))
                            $root.scala.meta.internal.semanticdb.Tree.encode(message.beforeExpansion, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.tpe != null && Object.hasOwnProperty.call(message, "tpe"))
                            $root.scala.meta.internal.semanticdb.Type.encode(message.tpe, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified MacroExpansionTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.MacroExpansionTree.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.MacroExpansionTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IMacroExpansionTree} message MacroExpansionTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    MacroExpansionTree.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a MacroExpansionTree message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.MacroExpansionTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.MacroExpansionTree} MacroExpansionTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    MacroExpansionTree.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.MacroExpansionTree();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.beforeExpansion = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.tpe = $root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a MacroExpansionTree message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.MacroExpansionTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.MacroExpansionTree} MacroExpansionTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    MacroExpansionTree.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a MacroExpansionTree message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.MacroExpansionTree
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    MacroExpansionTree.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.beforeExpansion != null && message.hasOwnProperty("beforeExpansion")) {
                            let error = $root.scala.meta.internal.semanticdb.Tree.verify(message.beforeExpansion);
                            if (error)
                                return "beforeExpansion." + error;
                        }
                        if (message.tpe != null && message.hasOwnProperty("tpe")) {
                            let error = $root.scala.meta.internal.semanticdb.Type.verify(message.tpe);
                            if (error)
                                return "tpe." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a MacroExpansionTree message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.MacroExpansionTree
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.MacroExpansionTree} MacroExpansionTree
                     */
                    MacroExpansionTree.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.MacroExpansionTree)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.MacroExpansionTree();
                        if (object.beforeExpansion != null) {
                            if (typeof object.beforeExpansion !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.MacroExpansionTree.beforeExpansion: object expected");
                            message.beforeExpansion = $root.scala.meta.internal.semanticdb.Tree.fromObject(object.beforeExpansion);
                        }
                        if (object.tpe != null) {
                            if (typeof object.tpe !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.MacroExpansionTree.tpe: object expected");
                            message.tpe = $root.scala.meta.internal.semanticdb.Type.fromObject(object.tpe);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a MacroExpansionTree message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.MacroExpansionTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.MacroExpansionTree} message MacroExpansionTree
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    MacroExpansionTree.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.beforeExpansion = null;
                            object.tpe = null;
                        }
                        if (message.beforeExpansion != null && message.hasOwnProperty("beforeExpansion"))
                            object.beforeExpansion = $root.scala.meta.internal.semanticdb.Tree.toObject(message.beforeExpansion, options);
                        if (message.tpe != null && message.hasOwnProperty("tpe"))
                            object.tpe = $root.scala.meta.internal.semanticdb.Type.toObject(message.tpe, options);
                        return object;
                    };

                    /**
                     * Converts this MacroExpansionTree to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.MacroExpansionTree
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    MacroExpansionTree.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for MacroExpansionTree
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.MacroExpansionTree
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    MacroExpansionTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.MacroExpansionTree";
                    };

                    return MacroExpansionTree;
                })();

                semanticdb.OriginalTree = (function() {

                    /**
                     * Properties of an OriginalTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface IOriginalTree
                     * @property {scala.meta.internal.semanticdb.IRange|null} [range] OriginalTree range
                     */

                    /**
                     * Constructs a new OriginalTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents an OriginalTree.
                     * @implements IOriginalTree
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.IOriginalTree=} [properties] Properties to set
                     */
                    function OriginalTree(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * OriginalTree range.
                     * @member {scala.meta.internal.semanticdb.IRange|null|undefined} range
                     * @memberof scala.meta.internal.semanticdb.OriginalTree
                     * @instance
                     */
                    OriginalTree.prototype.range = null;

                    /**
                     * Creates a new OriginalTree instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.OriginalTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IOriginalTree=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.OriginalTree} OriginalTree instance
                     */
                    OriginalTree.create = function create(properties) {
                        return new OriginalTree(properties);
                    };

                    /**
                     * Encodes the specified OriginalTree message. Does not implicitly {@link scala.meta.internal.semanticdb.OriginalTree.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.OriginalTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IOriginalTree} message OriginalTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    OriginalTree.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.range != null && Object.hasOwnProperty.call(message, "range"))
                            $root.scala.meta.internal.semanticdb.Range.encode(message.range, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified OriginalTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.OriginalTree.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.OriginalTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.IOriginalTree} message OriginalTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    OriginalTree.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes an OriginalTree message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.OriginalTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.OriginalTree} OriginalTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    OriginalTree.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.OriginalTree();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.range = $root.scala.meta.internal.semanticdb.Range.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes an OriginalTree message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.OriginalTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.OriginalTree} OriginalTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    OriginalTree.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies an OriginalTree message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.OriginalTree
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    OriginalTree.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.range != null && message.hasOwnProperty("range")) {
                            let error = $root.scala.meta.internal.semanticdb.Range.verify(message.range);
                            if (error)
                                return "range." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates an OriginalTree message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.OriginalTree
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.OriginalTree} OriginalTree
                     */
                    OriginalTree.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.OriginalTree)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.OriginalTree();
                        if (object.range != null) {
                            if (typeof object.range !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.OriginalTree.range: object expected");
                            message.range = $root.scala.meta.internal.semanticdb.Range.fromObject(object.range);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from an OriginalTree message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.OriginalTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.OriginalTree} message OriginalTree
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    OriginalTree.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults)
                            object.range = null;
                        if (message.range != null && message.hasOwnProperty("range"))
                            object.range = $root.scala.meta.internal.semanticdb.Range.toObject(message.range, options);
                        return object;
                    };

                    /**
                     * Converts this OriginalTree to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.OriginalTree
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    OriginalTree.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for OriginalTree
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.OriginalTree
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    OriginalTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.OriginalTree";
                    };

                    return OriginalTree;
                })();

                semanticdb.SelectTree = (function() {

                    /**
                     * Properties of a SelectTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ISelectTree
                     * @property {scala.meta.internal.semanticdb.ITree|null} [qualifier] SelectTree qualifier
                     * @property {scala.meta.internal.semanticdb.IIdTree|null} [id] SelectTree id
                     */

                    /**
                     * Constructs a new SelectTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a SelectTree.
                     * @implements ISelectTree
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ISelectTree=} [properties] Properties to set
                     */
                    function SelectTree(properties) {
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * SelectTree qualifier.
                     * @member {scala.meta.internal.semanticdb.ITree|null|undefined} qualifier
                     * @memberof scala.meta.internal.semanticdb.SelectTree
                     * @instance
                     */
                    SelectTree.prototype.qualifier = null;

                    /**
                     * SelectTree id.
                     * @member {scala.meta.internal.semanticdb.IIdTree|null|undefined} id
                     * @memberof scala.meta.internal.semanticdb.SelectTree
                     * @instance
                     */
                    SelectTree.prototype.id = null;

                    /**
                     * Creates a new SelectTree instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.SelectTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISelectTree=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.SelectTree} SelectTree instance
                     */
                    SelectTree.create = function create(properties) {
                        return new SelectTree(properties);
                    };

                    /**
                     * Encodes the specified SelectTree message. Does not implicitly {@link scala.meta.internal.semanticdb.SelectTree.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.SelectTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISelectTree} message SelectTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    SelectTree.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message.qualifier != null && Object.hasOwnProperty.call(message, "qualifier"))
                            $root.scala.meta.internal.semanticdb.Tree.encode(message.qualifier, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                            $root.scala.meta.internal.semanticdb.IdTree.encode(message.id, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified SelectTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.SelectTree.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.SelectTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ISelectTree} message SelectTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    SelectTree.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a SelectTree message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.SelectTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.SelectTree} SelectTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    SelectTree.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.SelectTree();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message.qualifier = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    message.id = $root.scala.meta.internal.semanticdb.IdTree.decode(reader, reader.uint32());
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a SelectTree message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.SelectTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.SelectTree} SelectTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    SelectTree.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a SelectTree message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.SelectTree
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    SelectTree.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message.qualifier != null && message.hasOwnProperty("qualifier")) {
                            let error = $root.scala.meta.internal.semanticdb.Tree.verify(message.qualifier);
                            if (error)
                                return "qualifier." + error;
                        }
                        if (message.id != null && message.hasOwnProperty("id")) {
                            let error = $root.scala.meta.internal.semanticdb.IdTree.verify(message.id);
                            if (error)
                                return "id." + error;
                        }
                        return null;
                    };

                    /**
                     * Creates a SelectTree message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.SelectTree
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.SelectTree} SelectTree
                     */
                    SelectTree.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.SelectTree)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.SelectTree();
                        if (object.qualifier != null) {
                            if (typeof object.qualifier !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.SelectTree.qualifier: object expected");
                            message.qualifier = $root.scala.meta.internal.semanticdb.Tree.fromObject(object.qualifier);
                        }
                        if (object.id != null) {
                            if (typeof object.id !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.SelectTree.id: object expected");
                            message.id = $root.scala.meta.internal.semanticdb.IdTree.fromObject(object.id);
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a SelectTree message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.SelectTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.SelectTree} message SelectTree
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    SelectTree.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.defaults) {
                            object.qualifier = null;
                            object.id = null;
                        }
                        if (message.qualifier != null && message.hasOwnProperty("qualifier"))
                            object.qualifier = $root.scala.meta.internal.semanticdb.Tree.toObject(message.qualifier, options);
                        if (message.id != null && message.hasOwnProperty("id"))
                            object.id = $root.scala.meta.internal.semanticdb.IdTree.toObject(message.id, options);
                        return object;
                    };

                    /**
                     * Converts this SelectTree to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.SelectTree
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    SelectTree.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for SelectTree
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.SelectTree
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    SelectTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.SelectTree";
                    };

                    return SelectTree;
                })();

                semanticdb.TypeApplyTree = (function() {

                    /**
                     * Properties of a TypeApplyTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @interface ITypeApplyTree
                     * @property {scala.meta.internal.semanticdb.ITree|null} ["function"] TypeApplyTree function
                     * @property {Array.<scala.meta.internal.semanticdb.IType>|null} [typeArguments] TypeApplyTree typeArguments
                     */

                    /**
                     * Constructs a new TypeApplyTree.
                     * @memberof scala.meta.internal.semanticdb
                     * @classdesc Represents a TypeApplyTree.
                     * @implements ITypeApplyTree
                     * @constructor
                     * @param {scala.meta.internal.semanticdb.ITypeApplyTree=} [properties] Properties to set
                     */
                    function TypeApplyTree(properties) {
                        this.typeArguments = [];
                        if (properties)
                            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null)
                                    this[keys[i]] = properties[keys[i]];
                    }

                    /**
                     * TypeApplyTree function.
                     * @member {scala.meta.internal.semanticdb.ITree|null|undefined} function
                     * @memberof scala.meta.internal.semanticdb.TypeApplyTree
                     * @instance
                     */
                    TypeApplyTree.prototype["function"] = null;

                    /**
                     * TypeApplyTree typeArguments.
                     * @member {Array.<scala.meta.internal.semanticdb.IType>} typeArguments
                     * @memberof scala.meta.internal.semanticdb.TypeApplyTree
                     * @instance
                     */
                    TypeApplyTree.prototype.typeArguments = $util.emptyArray;

                    /**
                     * Creates a new TypeApplyTree instance using the specified properties.
                     * @function create
                     * @memberof scala.meta.internal.semanticdb.TypeApplyTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITypeApplyTree=} [properties] Properties to set
                     * @returns {scala.meta.internal.semanticdb.TypeApplyTree} TypeApplyTree instance
                     */
                    TypeApplyTree.create = function create(properties) {
                        return new TypeApplyTree(properties);
                    };

                    /**
                     * Encodes the specified TypeApplyTree message. Does not implicitly {@link scala.meta.internal.semanticdb.TypeApplyTree.verify|verify} messages.
                     * @function encode
                     * @memberof scala.meta.internal.semanticdb.TypeApplyTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITypeApplyTree} message TypeApplyTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    TypeApplyTree.encode = function encode(message, writer) {
                        if (!writer)
                            writer = $Writer.create();
                        if (message["function"] != null && Object.hasOwnProperty.call(message, "function"))
                            $root.scala.meta.internal.semanticdb.Tree.encode(message["function"], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                        if (message.typeArguments != null && message.typeArguments.length)
                            for (let i = 0; i < message.typeArguments.length; ++i)
                                $root.scala.meta.internal.semanticdb.Type.encode(message.typeArguments[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                        return writer;
                    };

                    /**
                     * Encodes the specified TypeApplyTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.TypeApplyTree.verify|verify} messages.
                     * @function encodeDelimited
                     * @memberof scala.meta.internal.semanticdb.TypeApplyTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.ITypeApplyTree} message TypeApplyTree message or plain object to encode
                     * @param {$protobuf.Writer} [writer] Writer to encode to
                     * @returns {$protobuf.Writer} Writer
                     */
                    TypeApplyTree.encodeDelimited = function encodeDelimited(message, writer) {
                        return this.encode(message, writer).ldelim();
                    };

                    /**
                     * Decodes a TypeApplyTree message from the specified reader or buffer.
                     * @function decode
                     * @memberof scala.meta.internal.semanticdb.TypeApplyTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @param {number} [length] Message length if known beforehand
                     * @returns {scala.meta.internal.semanticdb.TypeApplyTree} TypeApplyTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    TypeApplyTree.decode = function decode(reader, length, error) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.scala.meta.internal.semanticdb.TypeApplyTree();
                        while (reader.pos < end) {
                            let tag = reader.uint32();
                            if (tag === error)
                                break;
                            switch (tag >>> 3) {
                            case 1: {
                                    message["function"] = $root.scala.meta.internal.semanticdb.Tree.decode(reader, reader.uint32());
                                    break;
                                }
                            case 2: {
                                    if (!(message.typeArguments && message.typeArguments.length))
                                        message.typeArguments = [];
                                    message.typeArguments.push($root.scala.meta.internal.semanticdb.Type.decode(reader, reader.uint32()));
                                    break;
                                }
                            default:
                                reader.skipType(tag & 7);
                                break;
                            }
                        }
                        return message;
                    };

                    /**
                     * Decodes a TypeApplyTree message from the specified reader or buffer, length delimited.
                     * @function decodeDelimited
                     * @memberof scala.meta.internal.semanticdb.TypeApplyTree
                     * @static
                     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
                     * @returns {scala.meta.internal.semanticdb.TypeApplyTree} TypeApplyTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    TypeApplyTree.decodeDelimited = function decodeDelimited(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.uint32());
                    };

                    /**
                     * Verifies a TypeApplyTree message.
                     * @function verify
                     * @memberof scala.meta.internal.semanticdb.TypeApplyTree
                     * @static
                     * @param {Object.<string,*>} message Plain object to verify
                     * @returns {string|null} `null` if valid, otherwise the reason why it is not
                     */
                    TypeApplyTree.verify = function verify(message) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (message["function"] != null && message.hasOwnProperty("function")) {
                            let error = $root.scala.meta.internal.semanticdb.Tree.verify(message["function"]);
                            if (error)
                                return "function." + error;
                        }
                        if (message.typeArguments != null && message.hasOwnProperty("typeArguments")) {
                            if (!Array.isArray(message.typeArguments))
                                return "typeArguments: array expected";
                            for (let i = 0; i < message.typeArguments.length; ++i) {
                                let error = $root.scala.meta.internal.semanticdb.Type.verify(message.typeArguments[i]);
                                if (error)
                                    return "typeArguments." + error;
                            }
                        }
                        return null;
                    };

                    /**
                     * Creates a TypeApplyTree message from a plain object. Also converts values to their respective internal types.
                     * @function fromObject
                     * @memberof scala.meta.internal.semanticdb.TypeApplyTree
                     * @static
                     * @param {Object.<string,*>} object Plain object
                     * @returns {scala.meta.internal.semanticdb.TypeApplyTree} TypeApplyTree
                     */
                    TypeApplyTree.fromObject = function fromObject(object) {
                        if (object instanceof $root.scala.meta.internal.semanticdb.TypeApplyTree)
                            return object;
                        let message = new $root.scala.meta.internal.semanticdb.TypeApplyTree();
                        if (object["function"] != null) {
                            if (typeof object["function"] !== "object")
                                throw TypeError(".scala.meta.internal.semanticdb.TypeApplyTree.function: object expected");
                            message["function"] = $root.scala.meta.internal.semanticdb.Tree.fromObject(object["function"]);
                        }
                        if (object.typeArguments) {
                            if (!Array.isArray(object.typeArguments))
                                throw TypeError(".scala.meta.internal.semanticdb.TypeApplyTree.typeArguments: array expected");
                            message.typeArguments = [];
                            for (let i = 0; i < object.typeArguments.length; ++i) {
                                if (typeof object.typeArguments[i] !== "object")
                                    throw TypeError(".scala.meta.internal.semanticdb.TypeApplyTree.typeArguments: object expected");
                                message.typeArguments[i] = $root.scala.meta.internal.semanticdb.Type.fromObject(object.typeArguments[i]);
                            }
                        }
                        return message;
                    };

                    /**
                     * Creates a plain object from a TypeApplyTree message. Also converts values to other types if specified.
                     * @function toObject
                     * @memberof scala.meta.internal.semanticdb.TypeApplyTree
                     * @static
                     * @param {scala.meta.internal.semanticdb.TypeApplyTree} message TypeApplyTree
                     * @param {$protobuf.IConversionOptions} [options] Conversion options
                     * @returns {Object.<string,*>} Plain object
                     */
                    TypeApplyTree.toObject = function toObject(message, options) {
                        if (!options)
                            options = {};
                        let object = {};
                        if (options.arrays || options.defaults)
                            object.typeArguments = [];
                        if (options.defaults)
                            object["function"] = null;
                        if (message["function"] != null && message.hasOwnProperty("function"))
                            object["function"] = $root.scala.meta.internal.semanticdb.Tree.toObject(message["function"], options);
                        if (message.typeArguments && message.typeArguments.length) {
                            object.typeArguments = [];
                            for (let j = 0; j < message.typeArguments.length; ++j)
                                object.typeArguments[j] = $root.scala.meta.internal.semanticdb.Type.toObject(message.typeArguments[j], options);
                        }
                        return object;
                    };

                    /**
                     * Converts this TypeApplyTree to JSON.
                     * @function toJSON
                     * @memberof scala.meta.internal.semanticdb.TypeApplyTree
                     * @instance
                     * @returns {Object.<string,*>} JSON object
                     */
                    TypeApplyTree.prototype.toJSON = function toJSON() {
                        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    /**
                     * Gets the default type url for TypeApplyTree
                     * @function getTypeUrl
                     * @memberof scala.meta.internal.semanticdb.TypeApplyTree
                     * @static
                     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns {string} The default type url
                     */
                    TypeApplyTree.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                        if (typeUrlPrefix === undefined) {
                            typeUrlPrefix = "type.googleapis.com";
                        }
                        return typeUrlPrefix + "/scala.meta.internal.semanticdb.TypeApplyTree";
                    };

                    return TypeApplyTree;
                })();

                return semanticdb;
            })();

            return internal;
        })();

        return meta;
    })();

    return scala;
})();

export { $root as default };
