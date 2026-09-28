import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace scala. */
export namespace scala {

    /** Namespace meta. */
    namespace meta {

        /** Namespace internal. */
        namespace internal {

            /** Namespace semanticdb. */
            namespace semanticdb {

                /** Schema enum. */
                enum Schema {
                    LEGACY = 0,
                    SEMANTICDB3 = 3,
                    SEMANTICDB4 = 4
                }

                /** Properties of a TextDocuments. */
                interface ITextDocuments {

                    /** TextDocuments documents */
                    documents?: (scala.meta.internal.semanticdb.ITextDocument[]|null);
                }

                /** Represents a TextDocuments. */
                class TextDocuments implements ITextDocuments {

                    /**
                     * Constructs a new TextDocuments.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ITextDocuments);

                    /** TextDocuments documents. */
                    public documents: scala.meta.internal.semanticdb.ITextDocument[];

                    /**
                     * Creates a new TextDocuments instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns TextDocuments instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ITextDocuments): scala.meta.internal.semanticdb.TextDocuments;

                    /**
                     * Encodes the specified TextDocuments message. Does not implicitly {@link scala.meta.internal.semanticdb.TextDocuments.verify|verify} messages.
                     * @param message TextDocuments message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ITextDocuments, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified TextDocuments message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.TextDocuments.verify|verify} messages.
                     * @param message TextDocuments message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ITextDocuments, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a TextDocuments message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns TextDocuments
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.TextDocuments;

                    /**
                     * Decodes a TextDocuments message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns TextDocuments
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.TextDocuments;

                    /**
                     * Verifies a TextDocuments message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a TextDocuments message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns TextDocuments
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.TextDocuments;

                    /**
                     * Creates a plain object from a TextDocuments message. Also converts values to other types if specified.
                     * @param message TextDocuments
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.TextDocuments, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this TextDocuments to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for TextDocuments
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a TextDocument. */
                interface ITextDocument {

                    /** TextDocument schema */
                    schema?: (scala.meta.internal.semanticdb.Schema|null);

                    /** TextDocument uri */
                    uri?: (string|null);

                    /** TextDocument text */
                    text?: (string|null);

                    /** TextDocument md5 */
                    md5?: (string|null);

                    /** TextDocument language */
                    language?: (scala.meta.internal.semanticdb.Language|null);

                    /** TextDocument symbols */
                    symbols?: (scala.meta.internal.semanticdb.ISymbolInformation[]|null);

                    /** TextDocument occurrences */
                    occurrences?: (scala.meta.internal.semanticdb.ISymbolOccurrence[]|null);

                    /** TextDocument diagnostics */
                    diagnostics?: (scala.meta.internal.semanticdb.IDiagnostic[]|null);

                    /** TextDocument synthetics */
                    synthetics?: (scala.meta.internal.semanticdb.ISynthetic[]|null);

                    /** TextDocument buildTarget */
                    buildTarget?: (string|null);
                }

                /** Represents a TextDocument. */
                class TextDocument implements ITextDocument {

                    /**
                     * Constructs a new TextDocument.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ITextDocument);

                    /** TextDocument schema. */
                    public schema: scala.meta.internal.semanticdb.Schema;

                    /** TextDocument uri. */
                    public uri: string;

                    /** TextDocument text. */
                    public text: string;

                    /** TextDocument md5. */
                    public md5: string;

                    /** TextDocument language. */
                    public language: scala.meta.internal.semanticdb.Language;

                    /** TextDocument symbols. */
                    public symbols: scala.meta.internal.semanticdb.ISymbolInformation[];

                    /** TextDocument occurrences. */
                    public occurrences: scala.meta.internal.semanticdb.ISymbolOccurrence[];

                    /** TextDocument diagnostics. */
                    public diagnostics: scala.meta.internal.semanticdb.IDiagnostic[];

                    /** TextDocument synthetics. */
                    public synthetics: scala.meta.internal.semanticdb.ISynthetic[];

                    /** TextDocument buildTarget. */
                    public buildTarget: string;

                    /**
                     * Creates a new TextDocument instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns TextDocument instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ITextDocument): scala.meta.internal.semanticdb.TextDocument;

                    /**
                     * Encodes the specified TextDocument message. Does not implicitly {@link scala.meta.internal.semanticdb.TextDocument.verify|verify} messages.
                     * @param message TextDocument message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ITextDocument, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified TextDocument message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.TextDocument.verify|verify} messages.
                     * @param message TextDocument message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ITextDocument, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a TextDocument message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns TextDocument
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.TextDocument;

                    /**
                     * Decodes a TextDocument message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns TextDocument
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.TextDocument;

                    /**
                     * Verifies a TextDocument message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a TextDocument message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns TextDocument
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.TextDocument;

                    /**
                     * Creates a plain object from a TextDocument message. Also converts values to other types if specified.
                     * @param message TextDocument
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.TextDocument, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this TextDocument to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for TextDocument
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Language enum. */
                enum Language {
                    UNKNOWN_LANGUAGE = 0,
                    SCALA = 1,
                    JAVA = 2,
                    PROTOBUF = 3
                }

                /** Properties of a Range. */
                interface IRange {

                    /** Range startLine */
                    startLine?: (number|null);

                    /** Range startCharacter */
                    startCharacter?: (number|null);

                    /** Range endLine */
                    endLine?: (number|null);

                    /** Range endCharacter */
                    endCharacter?: (number|null);
                }

                /** Represents a Range. */
                class Range implements IRange {

                    /**
                     * Constructs a new Range.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IRange);

                    /** Range startLine. */
                    public startLine: number;

                    /** Range startCharacter. */
                    public startCharacter: number;

                    /** Range endLine. */
                    public endLine: number;

                    /** Range endCharacter. */
                    public endCharacter: number;

                    /**
                     * Creates a new Range instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Range instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IRange): scala.meta.internal.semanticdb.Range;

                    /**
                     * Encodes the specified Range message. Does not implicitly {@link scala.meta.internal.semanticdb.Range.verify|verify} messages.
                     * @param message Range message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IRange, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Range message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Range.verify|verify} messages.
                     * @param message Range message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IRange, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Range message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Range
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.Range;

                    /**
                     * Decodes a Range message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Range
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.Range;

                    /**
                     * Verifies a Range message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Range message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Range
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.Range;

                    /**
                     * Creates a plain object from a Range message. Also converts values to other types if specified.
                     * @param message Range
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.Range, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Range to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Range
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Location. */
                interface ILocation {

                    /** Location uri */
                    uri?: (string|null);

                    /** Location range */
                    range?: (scala.meta.internal.semanticdb.IRange|null);
                }

                /** Represents a Location. */
                class Location implements ILocation {

                    /**
                     * Constructs a new Location.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ILocation);

                    /** Location uri. */
                    public uri: string;

                    /** Location range. */
                    public range?: (scala.meta.internal.semanticdb.IRange|null);

                    /**
                     * Creates a new Location instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Location instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ILocation): scala.meta.internal.semanticdb.Location;

                    /**
                     * Encodes the specified Location message. Does not implicitly {@link scala.meta.internal.semanticdb.Location.verify|verify} messages.
                     * @param message Location message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ILocation, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Location message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Location.verify|verify} messages.
                     * @param message Location message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ILocation, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Location message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Location
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.Location;

                    /**
                     * Decodes a Location message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Location
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.Location;

                    /**
                     * Verifies a Location message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Location message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Location
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.Location;

                    /**
                     * Creates a plain object from a Location message. Also converts values to other types if specified.
                     * @param message Location
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.Location, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Location to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Location
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Scope. */
                interface IScope {

                    /** Scope symlinks */
                    symlinks?: (string[]|null);

                    /** Scope hardlinks */
                    hardlinks?: (scala.meta.internal.semanticdb.ISymbolInformation[]|null);
                }

                /** Represents a Scope. */
                class Scope implements IScope {

                    /**
                     * Constructs a new Scope.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IScope);

                    /** Scope symlinks. */
                    public symlinks: string[];

                    /** Scope hardlinks. */
                    public hardlinks: scala.meta.internal.semanticdb.ISymbolInformation[];

                    /**
                     * Creates a new Scope instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Scope instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IScope): scala.meta.internal.semanticdb.Scope;

                    /**
                     * Encodes the specified Scope message. Does not implicitly {@link scala.meta.internal.semanticdb.Scope.verify|verify} messages.
                     * @param message Scope message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IScope, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Scope message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Scope.verify|verify} messages.
                     * @param message Scope message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IScope, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Scope message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Scope
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.Scope;

                    /**
                     * Decodes a Scope message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Scope
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.Scope;

                    /**
                     * Verifies a Scope message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Scope message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Scope
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.Scope;

                    /**
                     * Creates a plain object from a Scope message. Also converts values to other types if specified.
                     * @param message Scope
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.Scope, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Scope to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Scope
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Type. */
                interface IType {

                    /** Type typeRef */
                    typeRef?: (scala.meta.internal.semanticdb.ITypeRef|null);

                    /** Type singleType */
                    singleType?: (scala.meta.internal.semanticdb.ISingleType|null);

                    /** Type thisType */
                    thisType?: (scala.meta.internal.semanticdb.IThisType|null);

                    /** Type superType */
                    superType?: (scala.meta.internal.semanticdb.ISuperType|null);

                    /** Type constantType */
                    constantType?: (scala.meta.internal.semanticdb.IConstantType|null);

                    /** Type intersectionType */
                    intersectionType?: (scala.meta.internal.semanticdb.IIntersectionType|null);

                    /** Type unionType */
                    unionType?: (scala.meta.internal.semanticdb.IUnionType|null);

                    /** Type withType */
                    withType?: (scala.meta.internal.semanticdb.IWithType|null);

                    /** Type structuralType */
                    structuralType?: (scala.meta.internal.semanticdb.IStructuralType|null);

                    /** Type annotatedType */
                    annotatedType?: (scala.meta.internal.semanticdb.IAnnotatedType|null);

                    /** Type existentialType */
                    existentialType?: (scala.meta.internal.semanticdb.IExistentialType|null);

                    /** Type universalType */
                    universalType?: (scala.meta.internal.semanticdb.IUniversalType|null);

                    /** Type byNameType */
                    byNameType?: (scala.meta.internal.semanticdb.IByNameType|null);

                    /** Type repeatedType */
                    repeatedType?: (scala.meta.internal.semanticdb.IRepeatedType|null);

                    /** Type matchType */
                    matchType?: (scala.meta.internal.semanticdb.IMatchType|null);

                    /** Type lambdaType */
                    lambdaType?: (scala.meta.internal.semanticdb.ILambdaType|null);
                }

                /** Represents a Type. */
                class Type implements IType {

                    /**
                     * Constructs a new Type.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IType);

                    /** Type typeRef. */
                    public typeRef?: (scala.meta.internal.semanticdb.ITypeRef|null);

                    /** Type singleType. */
                    public singleType?: (scala.meta.internal.semanticdb.ISingleType|null);

                    /** Type thisType. */
                    public thisType?: (scala.meta.internal.semanticdb.IThisType|null);

                    /** Type superType. */
                    public superType?: (scala.meta.internal.semanticdb.ISuperType|null);

                    /** Type constantType. */
                    public constantType?: (scala.meta.internal.semanticdb.IConstantType|null);

                    /** Type intersectionType. */
                    public intersectionType?: (scala.meta.internal.semanticdb.IIntersectionType|null);

                    /** Type unionType. */
                    public unionType?: (scala.meta.internal.semanticdb.IUnionType|null);

                    /** Type withType. */
                    public withType?: (scala.meta.internal.semanticdb.IWithType|null);

                    /** Type structuralType. */
                    public structuralType?: (scala.meta.internal.semanticdb.IStructuralType|null);

                    /** Type annotatedType. */
                    public annotatedType?: (scala.meta.internal.semanticdb.IAnnotatedType|null);

                    /** Type existentialType. */
                    public existentialType?: (scala.meta.internal.semanticdb.IExistentialType|null);

                    /** Type universalType. */
                    public universalType?: (scala.meta.internal.semanticdb.IUniversalType|null);

                    /** Type byNameType. */
                    public byNameType?: (scala.meta.internal.semanticdb.IByNameType|null);

                    /** Type repeatedType. */
                    public repeatedType?: (scala.meta.internal.semanticdb.IRepeatedType|null);

                    /** Type matchType. */
                    public matchType?: (scala.meta.internal.semanticdb.IMatchType|null);

                    /** Type lambdaType. */
                    public lambdaType?: (scala.meta.internal.semanticdb.ILambdaType|null);

                    /** Type sealedValue. */
                    public sealedValue?: ("typeRef"|"singleType"|"thisType"|"superType"|"constantType"|"intersectionType"|"unionType"|"withType"|"structuralType"|"annotatedType"|"existentialType"|"universalType"|"byNameType"|"repeatedType"|"matchType"|"lambdaType");

                    /**
                     * Creates a new Type instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Type instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IType): scala.meta.internal.semanticdb.Type;

                    /**
                     * Encodes the specified Type message. Does not implicitly {@link scala.meta.internal.semanticdb.Type.verify|verify} messages.
                     * @param message Type message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Type message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Type.verify|verify} messages.
                     * @param message Type message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Type message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Type
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.Type;

                    /**
                     * Decodes a Type message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Type
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.Type;

                    /**
                     * Verifies a Type message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Type message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Type
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.Type;

                    /**
                     * Creates a plain object from a Type message. Also converts values to other types if specified.
                     * @param message Type
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.Type, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Type to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Type
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a LambdaType. */
                interface ILambdaType {

                    /** LambdaType parameters */
                    parameters?: (scala.meta.internal.semanticdb.IScope|null);

                    /** LambdaType returnType */
                    returnType?: (scala.meta.internal.semanticdb.IType|null);
                }

                /** Represents a LambdaType. */
                class LambdaType implements ILambdaType {

                    /**
                     * Constructs a new LambdaType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ILambdaType);

                    /** LambdaType parameters. */
                    public parameters?: (scala.meta.internal.semanticdb.IScope|null);

                    /** LambdaType returnType. */
                    public returnType?: (scala.meta.internal.semanticdb.IType|null);

                    /**
                     * Creates a new LambdaType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns LambdaType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ILambdaType): scala.meta.internal.semanticdb.LambdaType;

                    /**
                     * Encodes the specified LambdaType message. Does not implicitly {@link scala.meta.internal.semanticdb.LambdaType.verify|verify} messages.
                     * @param message LambdaType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ILambdaType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified LambdaType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.LambdaType.verify|verify} messages.
                     * @param message LambdaType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ILambdaType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a LambdaType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns LambdaType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.LambdaType;

                    /**
                     * Decodes a LambdaType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns LambdaType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.LambdaType;

                    /**
                     * Verifies a LambdaType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a LambdaType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns LambdaType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.LambdaType;

                    /**
                     * Creates a plain object from a LambdaType message. Also converts values to other types if specified.
                     * @param message LambdaType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.LambdaType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this LambdaType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for LambdaType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a TypeRef. */
                interface ITypeRef {

                    /** TypeRef prefix */
                    prefix?: (scala.meta.internal.semanticdb.IType|null);

                    /** TypeRef symbol */
                    symbol?: (string|null);

                    /** TypeRef typeArguments */
                    typeArguments?: (scala.meta.internal.semanticdb.IType[]|null);
                }

                /** Represents a TypeRef. */
                class TypeRef implements ITypeRef {

                    /**
                     * Constructs a new TypeRef.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ITypeRef);

                    /** TypeRef prefix. */
                    public prefix?: (scala.meta.internal.semanticdb.IType|null);

                    /** TypeRef symbol. */
                    public symbol: string;

                    /** TypeRef typeArguments. */
                    public typeArguments: scala.meta.internal.semanticdb.IType[];

                    /**
                     * Creates a new TypeRef instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns TypeRef instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ITypeRef): scala.meta.internal.semanticdb.TypeRef;

                    /**
                     * Encodes the specified TypeRef message. Does not implicitly {@link scala.meta.internal.semanticdb.TypeRef.verify|verify} messages.
                     * @param message TypeRef message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ITypeRef, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified TypeRef message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.TypeRef.verify|verify} messages.
                     * @param message TypeRef message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ITypeRef, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a TypeRef message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns TypeRef
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.TypeRef;

                    /**
                     * Decodes a TypeRef message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns TypeRef
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.TypeRef;

                    /**
                     * Verifies a TypeRef message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a TypeRef message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns TypeRef
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.TypeRef;

                    /**
                     * Creates a plain object from a TypeRef message. Also converts values to other types if specified.
                     * @param message TypeRef
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.TypeRef, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this TypeRef to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for TypeRef
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SingleType. */
                interface ISingleType {

                    /** SingleType prefix */
                    prefix?: (scala.meta.internal.semanticdb.IType|null);

                    /** SingleType symbol */
                    symbol?: (string|null);
                }

                /** Represents a SingleType. */
                class SingleType implements ISingleType {

                    /**
                     * Constructs a new SingleType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ISingleType);

                    /** SingleType prefix. */
                    public prefix?: (scala.meta.internal.semanticdb.IType|null);

                    /** SingleType symbol. */
                    public symbol: string;

                    /**
                     * Creates a new SingleType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SingleType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ISingleType): scala.meta.internal.semanticdb.SingleType;

                    /**
                     * Encodes the specified SingleType message. Does not implicitly {@link scala.meta.internal.semanticdb.SingleType.verify|verify} messages.
                     * @param message SingleType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ISingleType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SingleType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.SingleType.verify|verify} messages.
                     * @param message SingleType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ISingleType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SingleType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SingleType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.SingleType;

                    /**
                     * Decodes a SingleType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SingleType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.SingleType;

                    /**
                     * Verifies a SingleType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SingleType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SingleType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.SingleType;

                    /**
                     * Creates a plain object from a SingleType message. Also converts values to other types if specified.
                     * @param message SingleType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.SingleType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SingleType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SingleType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ThisType. */
                interface IThisType {

                    /** ThisType symbol */
                    symbol?: (string|null);
                }

                /** Represents a ThisType. */
                class ThisType implements IThisType {

                    /**
                     * Constructs a new ThisType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IThisType);

                    /** ThisType symbol. */
                    public symbol: string;

                    /**
                     * Creates a new ThisType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ThisType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IThisType): scala.meta.internal.semanticdb.ThisType;

                    /**
                     * Encodes the specified ThisType message. Does not implicitly {@link scala.meta.internal.semanticdb.ThisType.verify|verify} messages.
                     * @param message ThisType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IThisType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ThisType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ThisType.verify|verify} messages.
                     * @param message ThisType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IThisType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ThisType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ThisType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.ThisType;

                    /**
                     * Decodes a ThisType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ThisType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.ThisType;

                    /**
                     * Verifies a ThisType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ThisType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ThisType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.ThisType;

                    /**
                     * Creates a plain object from a ThisType message. Also converts values to other types if specified.
                     * @param message ThisType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.ThisType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ThisType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ThisType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SuperType. */
                interface ISuperType {

                    /** SuperType prefix */
                    prefix?: (scala.meta.internal.semanticdb.IType|null);

                    /** SuperType symbol */
                    symbol?: (string|null);
                }

                /** Represents a SuperType. */
                class SuperType implements ISuperType {

                    /**
                     * Constructs a new SuperType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ISuperType);

                    /** SuperType prefix. */
                    public prefix?: (scala.meta.internal.semanticdb.IType|null);

                    /** SuperType symbol. */
                    public symbol: string;

                    /**
                     * Creates a new SuperType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SuperType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ISuperType): scala.meta.internal.semanticdb.SuperType;

                    /**
                     * Encodes the specified SuperType message. Does not implicitly {@link scala.meta.internal.semanticdb.SuperType.verify|verify} messages.
                     * @param message SuperType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ISuperType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SuperType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.SuperType.verify|verify} messages.
                     * @param message SuperType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ISuperType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SuperType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SuperType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.SuperType;

                    /**
                     * Decodes a SuperType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SuperType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.SuperType;

                    /**
                     * Verifies a SuperType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SuperType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SuperType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.SuperType;

                    /**
                     * Creates a plain object from a SuperType message. Also converts values to other types if specified.
                     * @param message SuperType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.SuperType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SuperType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SuperType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ConstantType. */
                interface IConstantType {

                    /** ConstantType constant */
                    constant?: (scala.meta.internal.semanticdb.IConstant|null);
                }

                /** Represents a ConstantType. */
                class ConstantType implements IConstantType {

                    /**
                     * Constructs a new ConstantType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IConstantType);

                    /** ConstantType constant. */
                    public constant?: (scala.meta.internal.semanticdb.IConstant|null);

                    /**
                     * Creates a new ConstantType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ConstantType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IConstantType): scala.meta.internal.semanticdb.ConstantType;

                    /**
                     * Encodes the specified ConstantType message. Does not implicitly {@link scala.meta.internal.semanticdb.ConstantType.verify|verify} messages.
                     * @param message ConstantType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IConstantType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ConstantType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ConstantType.verify|verify} messages.
                     * @param message ConstantType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IConstantType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ConstantType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ConstantType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.ConstantType;

                    /**
                     * Decodes a ConstantType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ConstantType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.ConstantType;

                    /**
                     * Verifies a ConstantType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ConstantType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ConstantType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.ConstantType;

                    /**
                     * Creates a plain object from a ConstantType message. Also converts values to other types if specified.
                     * @param message ConstantType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.ConstantType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ConstantType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ConstantType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an IntersectionType. */
                interface IIntersectionType {

                    /** IntersectionType types */
                    types?: (scala.meta.internal.semanticdb.IType[]|null);
                }

                /** Represents an IntersectionType. */
                class IntersectionType implements IIntersectionType {

                    /**
                     * Constructs a new IntersectionType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IIntersectionType);

                    /** IntersectionType types. */
                    public types: scala.meta.internal.semanticdb.IType[];

                    /**
                     * Creates a new IntersectionType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns IntersectionType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IIntersectionType): scala.meta.internal.semanticdb.IntersectionType;

                    /**
                     * Encodes the specified IntersectionType message. Does not implicitly {@link scala.meta.internal.semanticdb.IntersectionType.verify|verify} messages.
                     * @param message IntersectionType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IIntersectionType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified IntersectionType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.IntersectionType.verify|verify} messages.
                     * @param message IntersectionType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IIntersectionType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an IntersectionType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns IntersectionType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.IntersectionType;

                    /**
                     * Decodes an IntersectionType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns IntersectionType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.IntersectionType;

                    /**
                     * Verifies an IntersectionType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an IntersectionType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns IntersectionType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.IntersectionType;

                    /**
                     * Creates a plain object from an IntersectionType message. Also converts values to other types if specified.
                     * @param message IntersectionType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.IntersectionType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this IntersectionType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for IntersectionType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UnionType. */
                interface IUnionType {

                    /** UnionType types */
                    types?: (scala.meta.internal.semanticdb.IType[]|null);
                }

                /** Represents an UnionType. */
                class UnionType implements IUnionType {

                    /**
                     * Constructs a new UnionType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IUnionType);

                    /** UnionType types. */
                    public types: scala.meta.internal.semanticdb.IType[];

                    /**
                     * Creates a new UnionType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UnionType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IUnionType): scala.meta.internal.semanticdb.UnionType;

                    /**
                     * Encodes the specified UnionType message. Does not implicitly {@link scala.meta.internal.semanticdb.UnionType.verify|verify} messages.
                     * @param message UnionType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IUnionType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UnionType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.UnionType.verify|verify} messages.
                     * @param message UnionType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IUnionType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an UnionType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UnionType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.UnionType;

                    /**
                     * Decodes an UnionType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UnionType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.UnionType;

                    /**
                     * Verifies an UnionType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an UnionType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UnionType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.UnionType;

                    /**
                     * Creates a plain object from an UnionType message. Also converts values to other types if specified.
                     * @param message UnionType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.UnionType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UnionType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UnionType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a WithType. */
                interface IWithType {

                    /** WithType types */
                    types?: (scala.meta.internal.semanticdb.IType[]|null);
                }

                /** Represents a WithType. */
                class WithType implements IWithType {

                    /**
                     * Constructs a new WithType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IWithType);

                    /** WithType types. */
                    public types: scala.meta.internal.semanticdb.IType[];

                    /**
                     * Creates a new WithType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns WithType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IWithType): scala.meta.internal.semanticdb.WithType;

                    /**
                     * Encodes the specified WithType message. Does not implicitly {@link scala.meta.internal.semanticdb.WithType.verify|verify} messages.
                     * @param message WithType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IWithType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified WithType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.WithType.verify|verify} messages.
                     * @param message WithType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IWithType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a WithType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns WithType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.WithType;

                    /**
                     * Decodes a WithType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns WithType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.WithType;

                    /**
                     * Verifies a WithType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a WithType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns WithType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.WithType;

                    /**
                     * Creates a plain object from a WithType message. Also converts values to other types if specified.
                     * @param message WithType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.WithType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this WithType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for WithType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a StructuralType. */
                interface IStructuralType {

                    /** StructuralType tpe */
                    tpe?: (scala.meta.internal.semanticdb.IType|null);

                    /** StructuralType declarations */
                    declarations?: (scala.meta.internal.semanticdb.IScope|null);
                }

                /** Represents a StructuralType. */
                class StructuralType implements IStructuralType {

                    /**
                     * Constructs a new StructuralType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IStructuralType);

                    /** StructuralType tpe. */
                    public tpe?: (scala.meta.internal.semanticdb.IType|null);

                    /** StructuralType declarations. */
                    public declarations?: (scala.meta.internal.semanticdb.IScope|null);

                    /**
                     * Creates a new StructuralType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns StructuralType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IStructuralType): scala.meta.internal.semanticdb.StructuralType;

                    /**
                     * Encodes the specified StructuralType message. Does not implicitly {@link scala.meta.internal.semanticdb.StructuralType.verify|verify} messages.
                     * @param message StructuralType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IStructuralType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified StructuralType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.StructuralType.verify|verify} messages.
                     * @param message StructuralType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IStructuralType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a StructuralType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns StructuralType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.StructuralType;

                    /**
                     * Decodes a StructuralType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns StructuralType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.StructuralType;

                    /**
                     * Verifies a StructuralType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a StructuralType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns StructuralType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.StructuralType;

                    /**
                     * Creates a plain object from a StructuralType message. Also converts values to other types if specified.
                     * @param message StructuralType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.StructuralType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this StructuralType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for StructuralType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AnnotatedType. */
                interface IAnnotatedType {

                    /** AnnotatedType annotations */
                    annotations?: (scala.meta.internal.semanticdb.IAnnotationTree[]|null);

                    /** AnnotatedType tpe */
                    tpe?: (scala.meta.internal.semanticdb.IType|null);
                }

                /** Represents an AnnotatedType. */
                class AnnotatedType implements IAnnotatedType {

                    /**
                     * Constructs a new AnnotatedType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IAnnotatedType);

                    /** AnnotatedType annotations. */
                    public annotations: scala.meta.internal.semanticdb.IAnnotationTree[];

                    /** AnnotatedType tpe. */
                    public tpe?: (scala.meta.internal.semanticdb.IType|null);

                    /**
                     * Creates a new AnnotatedType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AnnotatedType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IAnnotatedType): scala.meta.internal.semanticdb.AnnotatedType;

                    /**
                     * Encodes the specified AnnotatedType message. Does not implicitly {@link scala.meta.internal.semanticdb.AnnotatedType.verify|verify} messages.
                     * @param message AnnotatedType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IAnnotatedType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AnnotatedType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.AnnotatedType.verify|verify} messages.
                     * @param message AnnotatedType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IAnnotatedType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AnnotatedType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AnnotatedType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.AnnotatedType;

                    /**
                     * Decodes an AnnotatedType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AnnotatedType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.AnnotatedType;

                    /**
                     * Verifies an AnnotatedType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AnnotatedType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AnnotatedType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.AnnotatedType;

                    /**
                     * Creates a plain object from an AnnotatedType message. Also converts values to other types if specified.
                     * @param message AnnotatedType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.AnnotatedType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AnnotatedType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AnnotatedType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an ExistentialType. */
                interface IExistentialType {

                    /** ExistentialType tpe */
                    tpe?: (scala.meta.internal.semanticdb.IType|null);

                    /** ExistentialType declarations */
                    declarations?: (scala.meta.internal.semanticdb.IScope|null);
                }

                /** Represents an ExistentialType. */
                class ExistentialType implements IExistentialType {

                    /**
                     * Constructs a new ExistentialType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IExistentialType);

                    /** ExistentialType tpe. */
                    public tpe?: (scala.meta.internal.semanticdb.IType|null);

                    /** ExistentialType declarations. */
                    public declarations?: (scala.meta.internal.semanticdb.IScope|null);

                    /**
                     * Creates a new ExistentialType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ExistentialType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IExistentialType): scala.meta.internal.semanticdb.ExistentialType;

                    /**
                     * Encodes the specified ExistentialType message. Does not implicitly {@link scala.meta.internal.semanticdb.ExistentialType.verify|verify} messages.
                     * @param message ExistentialType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IExistentialType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ExistentialType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ExistentialType.verify|verify} messages.
                     * @param message ExistentialType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IExistentialType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an ExistentialType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ExistentialType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.ExistentialType;

                    /**
                     * Decodes an ExistentialType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ExistentialType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.ExistentialType;

                    /**
                     * Verifies an ExistentialType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an ExistentialType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ExistentialType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.ExistentialType;

                    /**
                     * Creates a plain object from an ExistentialType message. Also converts values to other types if specified.
                     * @param message ExistentialType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.ExistentialType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ExistentialType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ExistentialType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UniversalType. */
                interface IUniversalType {

                    /** UniversalType typeParameters */
                    typeParameters?: (scala.meta.internal.semanticdb.IScope|null);

                    /** UniversalType tpe */
                    tpe?: (scala.meta.internal.semanticdb.IType|null);
                }

                /** Represents an UniversalType. */
                class UniversalType implements IUniversalType {

                    /**
                     * Constructs a new UniversalType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IUniversalType);

                    /** UniversalType typeParameters. */
                    public typeParameters?: (scala.meta.internal.semanticdb.IScope|null);

                    /** UniversalType tpe. */
                    public tpe?: (scala.meta.internal.semanticdb.IType|null);

                    /**
                     * Creates a new UniversalType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UniversalType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IUniversalType): scala.meta.internal.semanticdb.UniversalType;

                    /**
                     * Encodes the specified UniversalType message. Does not implicitly {@link scala.meta.internal.semanticdb.UniversalType.verify|verify} messages.
                     * @param message UniversalType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IUniversalType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UniversalType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.UniversalType.verify|verify} messages.
                     * @param message UniversalType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IUniversalType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an UniversalType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UniversalType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.UniversalType;

                    /**
                     * Decodes an UniversalType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UniversalType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.UniversalType;

                    /**
                     * Verifies an UniversalType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an UniversalType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UniversalType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.UniversalType;

                    /**
                     * Creates a plain object from an UniversalType message. Also converts values to other types if specified.
                     * @param message UniversalType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.UniversalType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UniversalType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UniversalType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ByNameType. */
                interface IByNameType {

                    /** ByNameType tpe */
                    tpe?: (scala.meta.internal.semanticdb.IType|null);
                }

                /** Represents a ByNameType. */
                class ByNameType implements IByNameType {

                    /**
                     * Constructs a new ByNameType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IByNameType);

                    /** ByNameType tpe. */
                    public tpe?: (scala.meta.internal.semanticdb.IType|null);

                    /**
                     * Creates a new ByNameType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ByNameType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IByNameType): scala.meta.internal.semanticdb.ByNameType;

                    /**
                     * Encodes the specified ByNameType message. Does not implicitly {@link scala.meta.internal.semanticdb.ByNameType.verify|verify} messages.
                     * @param message ByNameType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IByNameType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ByNameType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ByNameType.verify|verify} messages.
                     * @param message ByNameType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IByNameType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ByNameType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ByNameType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.ByNameType;

                    /**
                     * Decodes a ByNameType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ByNameType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.ByNameType;

                    /**
                     * Verifies a ByNameType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ByNameType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ByNameType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.ByNameType;

                    /**
                     * Creates a plain object from a ByNameType message. Also converts values to other types if specified.
                     * @param message ByNameType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.ByNameType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ByNameType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ByNameType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a RepeatedType. */
                interface IRepeatedType {

                    /** RepeatedType tpe */
                    tpe?: (scala.meta.internal.semanticdb.IType|null);
                }

                /** Represents a RepeatedType. */
                class RepeatedType implements IRepeatedType {

                    /**
                     * Constructs a new RepeatedType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IRepeatedType);

                    /** RepeatedType tpe. */
                    public tpe?: (scala.meta.internal.semanticdb.IType|null);

                    /**
                     * Creates a new RepeatedType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns RepeatedType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IRepeatedType): scala.meta.internal.semanticdb.RepeatedType;

                    /**
                     * Encodes the specified RepeatedType message. Does not implicitly {@link scala.meta.internal.semanticdb.RepeatedType.verify|verify} messages.
                     * @param message RepeatedType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IRepeatedType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified RepeatedType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.RepeatedType.verify|verify} messages.
                     * @param message RepeatedType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IRepeatedType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a RepeatedType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns RepeatedType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.RepeatedType;

                    /**
                     * Decodes a RepeatedType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns RepeatedType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.RepeatedType;

                    /**
                     * Verifies a RepeatedType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a RepeatedType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns RepeatedType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.RepeatedType;

                    /**
                     * Creates a plain object from a RepeatedType message. Also converts values to other types if specified.
                     * @param message RepeatedType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.RepeatedType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this RepeatedType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for RepeatedType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a MatchType. */
                interface IMatchType {

                    /** MatchType scrutinee */
                    scrutinee?: (scala.meta.internal.semanticdb.IType|null);

                    /** MatchType cases */
                    cases?: (scala.meta.internal.semanticdb.MatchType.ICaseType[]|null);
                }

                /** Represents a MatchType. */
                class MatchType implements IMatchType {

                    /**
                     * Constructs a new MatchType.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IMatchType);

                    /** MatchType scrutinee. */
                    public scrutinee?: (scala.meta.internal.semanticdb.IType|null);

                    /** MatchType cases. */
                    public cases: scala.meta.internal.semanticdb.MatchType.ICaseType[];

                    /**
                     * Creates a new MatchType instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns MatchType instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IMatchType): scala.meta.internal.semanticdb.MatchType;

                    /**
                     * Encodes the specified MatchType message. Does not implicitly {@link scala.meta.internal.semanticdb.MatchType.verify|verify} messages.
                     * @param message MatchType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IMatchType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified MatchType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.MatchType.verify|verify} messages.
                     * @param message MatchType message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IMatchType, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a MatchType message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns MatchType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.MatchType;

                    /**
                     * Decodes a MatchType message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns MatchType
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.MatchType;

                    /**
                     * Verifies a MatchType message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a MatchType message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns MatchType
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.MatchType;

                    /**
                     * Creates a plain object from a MatchType message. Also converts values to other types if specified.
                     * @param message MatchType
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.MatchType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this MatchType to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for MatchType
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace MatchType {

                    /** Properties of a CaseType. */
                    interface ICaseType {

                        /** CaseType key */
                        key?: (scala.meta.internal.semanticdb.IType|null);

                        /** CaseType body */
                        body?: (scala.meta.internal.semanticdb.IType|null);
                    }

                    /** Represents a CaseType. */
                    class CaseType implements ICaseType {

                        /**
                         * Constructs a new CaseType.
                         * @param [properties] Properties to set
                         */
                        constructor(properties?: scala.meta.internal.semanticdb.MatchType.ICaseType);

                        /** CaseType key. */
                        public key?: (scala.meta.internal.semanticdb.IType|null);

                        /** CaseType body. */
                        public body?: (scala.meta.internal.semanticdb.IType|null);

                        /**
                         * Creates a new CaseType instance using the specified properties.
                         * @param [properties] Properties to set
                         * @returns CaseType instance
                         */
                        public static create(properties?: scala.meta.internal.semanticdb.MatchType.ICaseType): scala.meta.internal.semanticdb.MatchType.CaseType;

                        /**
                         * Encodes the specified CaseType message. Does not implicitly {@link scala.meta.internal.semanticdb.MatchType.CaseType.verify|verify} messages.
                         * @param message CaseType message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encode(message: scala.meta.internal.semanticdb.MatchType.ICaseType, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Encodes the specified CaseType message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.MatchType.CaseType.verify|verify} messages.
                         * @param message CaseType message or plain object to encode
                         * @param [writer] Writer to encode to
                         * @returns Writer
                         */
                        public static encodeDelimited(message: scala.meta.internal.semanticdb.MatchType.ICaseType, writer?: $protobuf.Writer): $protobuf.Writer;

                        /**
                         * Decodes a CaseType message from the specified reader or buffer.
                         * @param reader Reader or buffer to decode from
                         * @param [length] Message length if known beforehand
                         * @returns CaseType
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.MatchType.CaseType;

                        /**
                         * Decodes a CaseType message from the specified reader or buffer, length delimited.
                         * @param reader Reader or buffer to decode from
                         * @returns CaseType
                         * @throws {Error} If the payload is not a reader or valid buffer
                         * @throws {$protobuf.util.ProtocolError} If required fields are missing
                         */
                        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.MatchType.CaseType;

                        /**
                         * Verifies a CaseType message.
                         * @param message Plain object to verify
                         * @returns `null` if valid, otherwise the reason why it is not
                         */
                        public static verify(message: { [k: string]: any }): (string|null);

                        /**
                         * Creates a CaseType message from a plain object. Also converts values to their respective internal types.
                         * @param object Plain object
                         * @returns CaseType
                         */
                        public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.MatchType.CaseType;

                        /**
                         * Creates a plain object from a CaseType message. Also converts values to other types if specified.
                         * @param message CaseType
                         * @param [options] Conversion options
                         * @returns Plain object
                         */
                        public static toObject(message: scala.meta.internal.semanticdb.MatchType.CaseType, options?: $protobuf.IConversionOptions): { [k: string]: any };

                        /**
                         * Converts this CaseType to JSON.
                         * @returns JSON object
                         */
                        public toJSON(): { [k: string]: any };

                        /**
                         * Gets the default type url for CaseType
                         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                         * @returns The default type url
                         */
                        public static getTypeUrl(typeUrlPrefix?: string): string;
                    }
                }

                /** Properties of a Constant. */
                interface IConstant {

                    /** Constant unitConstant */
                    unitConstant?: (scala.meta.internal.semanticdb.IUnitConstant|null);

                    /** Constant booleanConstant */
                    booleanConstant?: (scala.meta.internal.semanticdb.IBooleanConstant|null);

                    /** Constant byteConstant */
                    byteConstant?: (scala.meta.internal.semanticdb.IByteConstant|null);

                    /** Constant shortConstant */
                    shortConstant?: (scala.meta.internal.semanticdb.IShortConstant|null);

                    /** Constant charConstant */
                    charConstant?: (scala.meta.internal.semanticdb.ICharConstant|null);

                    /** Constant intConstant */
                    intConstant?: (scala.meta.internal.semanticdb.IIntConstant|null);

                    /** Constant longConstant */
                    longConstant?: (scala.meta.internal.semanticdb.ILongConstant|null);

                    /** Constant floatConstant */
                    floatConstant?: (scala.meta.internal.semanticdb.IFloatConstant|null);

                    /** Constant doubleConstant */
                    doubleConstant?: (scala.meta.internal.semanticdb.IDoubleConstant|null);

                    /** Constant stringConstant */
                    stringConstant?: (scala.meta.internal.semanticdb.IStringConstant|null);

                    /** Constant nullConstant */
                    nullConstant?: (scala.meta.internal.semanticdb.INullConstant|null);
                }

                /** Represents a Constant. */
                class Constant implements IConstant {

                    /**
                     * Constructs a new Constant.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IConstant);

                    /** Constant unitConstant. */
                    public unitConstant?: (scala.meta.internal.semanticdb.IUnitConstant|null);

                    /** Constant booleanConstant. */
                    public booleanConstant?: (scala.meta.internal.semanticdb.IBooleanConstant|null);

                    /** Constant byteConstant. */
                    public byteConstant?: (scala.meta.internal.semanticdb.IByteConstant|null);

                    /** Constant shortConstant. */
                    public shortConstant?: (scala.meta.internal.semanticdb.IShortConstant|null);

                    /** Constant charConstant. */
                    public charConstant?: (scala.meta.internal.semanticdb.ICharConstant|null);

                    /** Constant intConstant. */
                    public intConstant?: (scala.meta.internal.semanticdb.IIntConstant|null);

                    /** Constant longConstant. */
                    public longConstant?: (scala.meta.internal.semanticdb.ILongConstant|null);

                    /** Constant floatConstant. */
                    public floatConstant?: (scala.meta.internal.semanticdb.IFloatConstant|null);

                    /** Constant doubleConstant. */
                    public doubleConstant?: (scala.meta.internal.semanticdb.IDoubleConstant|null);

                    /** Constant stringConstant. */
                    public stringConstant?: (scala.meta.internal.semanticdb.IStringConstant|null);

                    /** Constant nullConstant. */
                    public nullConstant?: (scala.meta.internal.semanticdb.INullConstant|null);

                    /** Constant sealedValue. */
                    public sealedValue?: ("unitConstant"|"booleanConstant"|"byteConstant"|"shortConstant"|"charConstant"|"intConstant"|"longConstant"|"floatConstant"|"doubleConstant"|"stringConstant"|"nullConstant");

                    /**
                     * Creates a new Constant instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Constant instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IConstant): scala.meta.internal.semanticdb.Constant;

                    /**
                     * Encodes the specified Constant message. Does not implicitly {@link scala.meta.internal.semanticdb.Constant.verify|verify} messages.
                     * @param message Constant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Constant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Constant.verify|verify} messages.
                     * @param message Constant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Constant message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Constant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.Constant;

                    /**
                     * Decodes a Constant message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Constant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.Constant;

                    /**
                     * Verifies a Constant message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Constant message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Constant
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.Constant;

                    /**
                     * Creates a plain object from a Constant message. Also converts values to other types if specified.
                     * @param message Constant
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.Constant, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Constant to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Constant
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an UnitConstant. */
                interface IUnitConstant {
                }

                /** Represents an UnitConstant. */
                class UnitConstant implements IUnitConstant {

                    /**
                     * Constructs a new UnitConstant.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IUnitConstant);

                    /**
                     * Creates a new UnitConstant instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns UnitConstant instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IUnitConstant): scala.meta.internal.semanticdb.UnitConstant;

                    /**
                     * Encodes the specified UnitConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.UnitConstant.verify|verify} messages.
                     * @param message UnitConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IUnitConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified UnitConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.UnitConstant.verify|verify} messages.
                     * @param message UnitConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IUnitConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an UnitConstant message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns UnitConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.UnitConstant;

                    /**
                     * Decodes an UnitConstant message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns UnitConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.UnitConstant;

                    /**
                     * Verifies an UnitConstant message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an UnitConstant message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns UnitConstant
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.UnitConstant;

                    /**
                     * Creates a plain object from an UnitConstant message. Also converts values to other types if specified.
                     * @param message UnitConstant
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.UnitConstant, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this UnitConstant to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for UnitConstant
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a BooleanConstant. */
                interface IBooleanConstant {

                    /** BooleanConstant value */
                    value?: (boolean|null);
                }

                /** Represents a BooleanConstant. */
                class BooleanConstant implements IBooleanConstant {

                    /**
                     * Constructs a new BooleanConstant.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IBooleanConstant);

                    /** BooleanConstant value. */
                    public value: boolean;

                    /**
                     * Creates a new BooleanConstant instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns BooleanConstant instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IBooleanConstant): scala.meta.internal.semanticdb.BooleanConstant;

                    /**
                     * Encodes the specified BooleanConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.BooleanConstant.verify|verify} messages.
                     * @param message BooleanConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IBooleanConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified BooleanConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.BooleanConstant.verify|verify} messages.
                     * @param message BooleanConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IBooleanConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a BooleanConstant message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns BooleanConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.BooleanConstant;

                    /**
                     * Decodes a BooleanConstant message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns BooleanConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.BooleanConstant;

                    /**
                     * Verifies a BooleanConstant message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a BooleanConstant message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns BooleanConstant
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.BooleanConstant;

                    /**
                     * Creates a plain object from a BooleanConstant message. Also converts values to other types if specified.
                     * @param message BooleanConstant
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.BooleanConstant, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this BooleanConstant to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for BooleanConstant
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ByteConstant. */
                interface IByteConstant {

                    /** ByteConstant value */
                    value?: (number|null);
                }

                /** Represents a ByteConstant. */
                class ByteConstant implements IByteConstant {

                    /**
                     * Constructs a new ByteConstant.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IByteConstant);

                    /** ByteConstant value. */
                    public value: number;

                    /**
                     * Creates a new ByteConstant instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ByteConstant instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IByteConstant): scala.meta.internal.semanticdb.ByteConstant;

                    /**
                     * Encodes the specified ByteConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.ByteConstant.verify|verify} messages.
                     * @param message ByteConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IByteConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ByteConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ByteConstant.verify|verify} messages.
                     * @param message ByteConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IByteConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ByteConstant message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ByteConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.ByteConstant;

                    /**
                     * Decodes a ByteConstant message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ByteConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.ByteConstant;

                    /**
                     * Verifies a ByteConstant message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ByteConstant message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ByteConstant
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.ByteConstant;

                    /**
                     * Creates a plain object from a ByteConstant message. Also converts values to other types if specified.
                     * @param message ByteConstant
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.ByteConstant, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ByteConstant to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ByteConstant
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ShortConstant. */
                interface IShortConstant {

                    /** ShortConstant value */
                    value?: (number|null);
                }

                /** Represents a ShortConstant. */
                class ShortConstant implements IShortConstant {

                    /**
                     * Constructs a new ShortConstant.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IShortConstant);

                    /** ShortConstant value. */
                    public value: number;

                    /**
                     * Creates a new ShortConstant instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ShortConstant instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IShortConstant): scala.meta.internal.semanticdb.ShortConstant;

                    /**
                     * Encodes the specified ShortConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.ShortConstant.verify|verify} messages.
                     * @param message ShortConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IShortConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ShortConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ShortConstant.verify|verify} messages.
                     * @param message ShortConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IShortConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ShortConstant message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ShortConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.ShortConstant;

                    /**
                     * Decodes a ShortConstant message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ShortConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.ShortConstant;

                    /**
                     * Verifies a ShortConstant message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ShortConstant message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ShortConstant
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.ShortConstant;

                    /**
                     * Creates a plain object from a ShortConstant message. Also converts values to other types if specified.
                     * @param message ShortConstant
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.ShortConstant, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ShortConstant to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ShortConstant
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a CharConstant. */
                interface ICharConstant {

                    /** CharConstant value */
                    value?: (number|null);
                }

                /** Represents a CharConstant. */
                class CharConstant implements ICharConstant {

                    /**
                     * Constructs a new CharConstant.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ICharConstant);

                    /** CharConstant value. */
                    public value: number;

                    /**
                     * Creates a new CharConstant instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns CharConstant instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ICharConstant): scala.meta.internal.semanticdb.CharConstant;

                    /**
                     * Encodes the specified CharConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.CharConstant.verify|verify} messages.
                     * @param message CharConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ICharConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified CharConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.CharConstant.verify|verify} messages.
                     * @param message CharConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ICharConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a CharConstant message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns CharConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.CharConstant;

                    /**
                     * Decodes a CharConstant message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns CharConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.CharConstant;

                    /**
                     * Verifies a CharConstant message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a CharConstant message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns CharConstant
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.CharConstant;

                    /**
                     * Creates a plain object from a CharConstant message. Also converts values to other types if specified.
                     * @param message CharConstant
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.CharConstant, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this CharConstant to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for CharConstant
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an IntConstant. */
                interface IIntConstant {

                    /** IntConstant value */
                    value?: (number|null);
                }

                /** Represents an IntConstant. */
                class IntConstant implements IIntConstant {

                    /**
                     * Constructs a new IntConstant.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IIntConstant);

                    /** IntConstant value. */
                    public value: number;

                    /**
                     * Creates a new IntConstant instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns IntConstant instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IIntConstant): scala.meta.internal.semanticdb.IntConstant;

                    /**
                     * Encodes the specified IntConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.IntConstant.verify|verify} messages.
                     * @param message IntConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IIntConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified IntConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.IntConstant.verify|verify} messages.
                     * @param message IntConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IIntConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an IntConstant message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns IntConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.IntConstant;

                    /**
                     * Decodes an IntConstant message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns IntConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.IntConstant;

                    /**
                     * Verifies an IntConstant message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an IntConstant message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns IntConstant
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.IntConstant;

                    /**
                     * Creates a plain object from an IntConstant message. Also converts values to other types if specified.
                     * @param message IntConstant
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.IntConstant, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this IntConstant to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for IntConstant
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a LongConstant. */
                interface ILongConstant {

                    /** LongConstant value */
                    value?: (number|Long|null);
                }

                /** Represents a LongConstant. */
                class LongConstant implements ILongConstant {

                    /**
                     * Constructs a new LongConstant.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ILongConstant);

                    /** LongConstant value. */
                    public value: (number|Long);

                    /**
                     * Creates a new LongConstant instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns LongConstant instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ILongConstant): scala.meta.internal.semanticdb.LongConstant;

                    /**
                     * Encodes the specified LongConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.LongConstant.verify|verify} messages.
                     * @param message LongConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ILongConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified LongConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.LongConstant.verify|verify} messages.
                     * @param message LongConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ILongConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a LongConstant message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns LongConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.LongConstant;

                    /**
                     * Decodes a LongConstant message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns LongConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.LongConstant;

                    /**
                     * Verifies a LongConstant message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a LongConstant message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns LongConstant
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.LongConstant;

                    /**
                     * Creates a plain object from a LongConstant message. Also converts values to other types if specified.
                     * @param message LongConstant
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.LongConstant, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this LongConstant to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for LongConstant
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a FloatConstant. */
                interface IFloatConstant {

                    /** FloatConstant value */
                    value?: (number|null);
                }

                /** Represents a FloatConstant. */
                class FloatConstant implements IFloatConstant {

                    /**
                     * Constructs a new FloatConstant.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IFloatConstant);

                    /** FloatConstant value. */
                    public value: number;

                    /**
                     * Creates a new FloatConstant instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns FloatConstant instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IFloatConstant): scala.meta.internal.semanticdb.FloatConstant;

                    /**
                     * Encodes the specified FloatConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.FloatConstant.verify|verify} messages.
                     * @param message FloatConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IFloatConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified FloatConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.FloatConstant.verify|verify} messages.
                     * @param message FloatConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IFloatConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a FloatConstant message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns FloatConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.FloatConstant;

                    /**
                     * Decodes a FloatConstant message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns FloatConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.FloatConstant;

                    /**
                     * Verifies a FloatConstant message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a FloatConstant message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns FloatConstant
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.FloatConstant;

                    /**
                     * Creates a plain object from a FloatConstant message. Also converts values to other types if specified.
                     * @param message FloatConstant
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.FloatConstant, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this FloatConstant to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for FloatConstant
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a DoubleConstant. */
                interface IDoubleConstant {

                    /** DoubleConstant value */
                    value?: (number|null);
                }

                /** Represents a DoubleConstant. */
                class DoubleConstant implements IDoubleConstant {

                    /**
                     * Constructs a new DoubleConstant.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IDoubleConstant);

                    /** DoubleConstant value. */
                    public value: number;

                    /**
                     * Creates a new DoubleConstant instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns DoubleConstant instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IDoubleConstant): scala.meta.internal.semanticdb.DoubleConstant;

                    /**
                     * Encodes the specified DoubleConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.DoubleConstant.verify|verify} messages.
                     * @param message DoubleConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IDoubleConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified DoubleConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.DoubleConstant.verify|verify} messages.
                     * @param message DoubleConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IDoubleConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a DoubleConstant message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns DoubleConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.DoubleConstant;

                    /**
                     * Decodes a DoubleConstant message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns DoubleConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.DoubleConstant;

                    /**
                     * Verifies a DoubleConstant message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a DoubleConstant message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns DoubleConstant
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.DoubleConstant;

                    /**
                     * Creates a plain object from a DoubleConstant message. Also converts values to other types if specified.
                     * @param message DoubleConstant
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.DoubleConstant, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this DoubleConstant to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for DoubleConstant
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a StringConstant. */
                interface IStringConstant {

                    /** StringConstant value */
                    value?: (string|null);
                }

                /** Represents a StringConstant. */
                class StringConstant implements IStringConstant {

                    /**
                     * Constructs a new StringConstant.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IStringConstant);

                    /** StringConstant value. */
                    public value: string;

                    /**
                     * Creates a new StringConstant instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns StringConstant instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IStringConstant): scala.meta.internal.semanticdb.StringConstant;

                    /**
                     * Encodes the specified StringConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.StringConstant.verify|verify} messages.
                     * @param message StringConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IStringConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified StringConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.StringConstant.verify|verify} messages.
                     * @param message StringConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IStringConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a StringConstant message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns StringConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.StringConstant;

                    /**
                     * Decodes a StringConstant message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns StringConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.StringConstant;

                    /**
                     * Verifies a StringConstant message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a StringConstant message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns StringConstant
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.StringConstant;

                    /**
                     * Creates a plain object from a StringConstant message. Also converts values to other types if specified.
                     * @param message StringConstant
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.StringConstant, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this StringConstant to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for StringConstant
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a NullConstant. */
                interface INullConstant {
                }

                /** Represents a NullConstant. */
                class NullConstant implements INullConstant {

                    /**
                     * Constructs a new NullConstant.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.INullConstant);

                    /**
                     * Creates a new NullConstant instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns NullConstant instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.INullConstant): scala.meta.internal.semanticdb.NullConstant;

                    /**
                     * Encodes the specified NullConstant message. Does not implicitly {@link scala.meta.internal.semanticdb.NullConstant.verify|verify} messages.
                     * @param message NullConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.INullConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified NullConstant message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.NullConstant.verify|verify} messages.
                     * @param message NullConstant message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.INullConstant, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a NullConstant message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns NullConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.NullConstant;

                    /**
                     * Decodes a NullConstant message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns NullConstant
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.NullConstant;

                    /**
                     * Verifies a NullConstant message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a NullConstant message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns NullConstant
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.NullConstant;

                    /**
                     * Creates a plain object from a NullConstant message. Also converts values to other types if specified.
                     * @param message NullConstant
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.NullConstant, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this NullConstant to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for NullConstant
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Signature. */
                interface ISignature {

                    /** Signature classSignature */
                    classSignature?: (scala.meta.internal.semanticdb.IClassSignature|null);

                    /** Signature methodSignature */
                    methodSignature?: (scala.meta.internal.semanticdb.IMethodSignature|null);

                    /** Signature typeSignature */
                    typeSignature?: (scala.meta.internal.semanticdb.ITypeSignature|null);

                    /** Signature valueSignature */
                    valueSignature?: (scala.meta.internal.semanticdb.IValueSignature|null);
                }

                /** Represents a Signature. */
                class Signature implements ISignature {

                    /**
                     * Constructs a new Signature.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ISignature);

                    /** Signature classSignature. */
                    public classSignature?: (scala.meta.internal.semanticdb.IClassSignature|null);

                    /** Signature methodSignature. */
                    public methodSignature?: (scala.meta.internal.semanticdb.IMethodSignature|null);

                    /** Signature typeSignature. */
                    public typeSignature?: (scala.meta.internal.semanticdb.ITypeSignature|null);

                    /** Signature valueSignature. */
                    public valueSignature?: (scala.meta.internal.semanticdb.IValueSignature|null);

                    /** Signature sealedValue. */
                    public sealedValue?: ("classSignature"|"methodSignature"|"typeSignature"|"valueSignature");

                    /**
                     * Creates a new Signature instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Signature instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ISignature): scala.meta.internal.semanticdb.Signature;

                    /**
                     * Encodes the specified Signature message. Does not implicitly {@link scala.meta.internal.semanticdb.Signature.verify|verify} messages.
                     * @param message Signature message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ISignature, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Signature message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Signature.verify|verify} messages.
                     * @param message Signature message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ISignature, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Signature message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Signature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.Signature;

                    /**
                     * Decodes a Signature message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Signature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.Signature;

                    /**
                     * Verifies a Signature message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Signature message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Signature
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.Signature;

                    /**
                     * Creates a plain object from a Signature message. Also converts values to other types if specified.
                     * @param message Signature
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.Signature, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Signature to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Signature
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ClassSignature. */
                interface IClassSignature {

                    /** ClassSignature typeParameters */
                    typeParameters?: (scala.meta.internal.semanticdb.IScope|null);

                    /** ClassSignature parents */
                    parents?: (scala.meta.internal.semanticdb.IType[]|null);

                    /** ClassSignature self */
                    self?: (scala.meta.internal.semanticdb.IType|null);

                    /** ClassSignature declarations */
                    declarations?: (scala.meta.internal.semanticdb.IScope|null);
                }

                /** Represents a ClassSignature. */
                class ClassSignature implements IClassSignature {

                    /**
                     * Constructs a new ClassSignature.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IClassSignature);

                    /** ClassSignature typeParameters. */
                    public typeParameters?: (scala.meta.internal.semanticdb.IScope|null);

                    /** ClassSignature parents. */
                    public parents: scala.meta.internal.semanticdb.IType[];

                    /** ClassSignature self. */
                    public self?: (scala.meta.internal.semanticdb.IType|null);

                    /** ClassSignature declarations. */
                    public declarations?: (scala.meta.internal.semanticdb.IScope|null);

                    /**
                     * Creates a new ClassSignature instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ClassSignature instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IClassSignature): scala.meta.internal.semanticdb.ClassSignature;

                    /**
                     * Encodes the specified ClassSignature message. Does not implicitly {@link scala.meta.internal.semanticdb.ClassSignature.verify|verify} messages.
                     * @param message ClassSignature message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IClassSignature, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ClassSignature message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ClassSignature.verify|verify} messages.
                     * @param message ClassSignature message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IClassSignature, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ClassSignature message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ClassSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.ClassSignature;

                    /**
                     * Decodes a ClassSignature message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ClassSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.ClassSignature;

                    /**
                     * Verifies a ClassSignature message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ClassSignature message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ClassSignature
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.ClassSignature;

                    /**
                     * Creates a plain object from a ClassSignature message. Also converts values to other types if specified.
                     * @param message ClassSignature
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.ClassSignature, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ClassSignature to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ClassSignature
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a MethodSignature. */
                interface IMethodSignature {

                    /** MethodSignature typeParameters */
                    typeParameters?: (scala.meta.internal.semanticdb.IScope|null);

                    /** MethodSignature parameterLists */
                    parameterLists?: (scala.meta.internal.semanticdb.IScope[]|null);

                    /** MethodSignature returnType */
                    returnType?: (scala.meta.internal.semanticdb.IType|null);

                    /** MethodSignature throws */
                    throws?: (scala.meta.internal.semanticdb.IType[]|null);
                }

                /** Represents a MethodSignature. */
                class MethodSignature implements IMethodSignature {

                    /**
                     * Constructs a new MethodSignature.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IMethodSignature);

                    /** MethodSignature typeParameters. */
                    public typeParameters?: (scala.meta.internal.semanticdb.IScope|null);

                    /** MethodSignature parameterLists. */
                    public parameterLists: scala.meta.internal.semanticdb.IScope[];

                    /** MethodSignature returnType. */
                    public returnType?: (scala.meta.internal.semanticdb.IType|null);

                    /** MethodSignature throws. */
                    public throws: scala.meta.internal.semanticdb.IType[];

                    /**
                     * Creates a new MethodSignature instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns MethodSignature instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IMethodSignature): scala.meta.internal.semanticdb.MethodSignature;

                    /**
                     * Encodes the specified MethodSignature message. Does not implicitly {@link scala.meta.internal.semanticdb.MethodSignature.verify|verify} messages.
                     * @param message MethodSignature message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IMethodSignature, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified MethodSignature message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.MethodSignature.verify|verify} messages.
                     * @param message MethodSignature message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IMethodSignature, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a MethodSignature message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns MethodSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.MethodSignature;

                    /**
                     * Decodes a MethodSignature message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns MethodSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.MethodSignature;

                    /**
                     * Verifies a MethodSignature message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a MethodSignature message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns MethodSignature
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.MethodSignature;

                    /**
                     * Creates a plain object from a MethodSignature message. Also converts values to other types if specified.
                     * @param message MethodSignature
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.MethodSignature, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this MethodSignature to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for MethodSignature
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a TypeSignature. */
                interface ITypeSignature {

                    /** TypeSignature typeParameters */
                    typeParameters?: (scala.meta.internal.semanticdb.IScope|null);

                    /** TypeSignature lowerBound */
                    lowerBound?: (scala.meta.internal.semanticdb.IType|null);

                    /** TypeSignature upperBound */
                    upperBound?: (scala.meta.internal.semanticdb.IType|null);
                }

                /** Represents a TypeSignature. */
                class TypeSignature implements ITypeSignature {

                    /**
                     * Constructs a new TypeSignature.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ITypeSignature);

                    /** TypeSignature typeParameters. */
                    public typeParameters?: (scala.meta.internal.semanticdb.IScope|null);

                    /** TypeSignature lowerBound. */
                    public lowerBound?: (scala.meta.internal.semanticdb.IType|null);

                    /** TypeSignature upperBound. */
                    public upperBound?: (scala.meta.internal.semanticdb.IType|null);

                    /**
                     * Creates a new TypeSignature instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns TypeSignature instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ITypeSignature): scala.meta.internal.semanticdb.TypeSignature;

                    /**
                     * Encodes the specified TypeSignature message. Does not implicitly {@link scala.meta.internal.semanticdb.TypeSignature.verify|verify} messages.
                     * @param message TypeSignature message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ITypeSignature, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified TypeSignature message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.TypeSignature.verify|verify} messages.
                     * @param message TypeSignature message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ITypeSignature, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a TypeSignature message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns TypeSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.TypeSignature;

                    /**
                     * Decodes a TypeSignature message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns TypeSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.TypeSignature;

                    /**
                     * Verifies a TypeSignature message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a TypeSignature message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns TypeSignature
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.TypeSignature;

                    /**
                     * Creates a plain object from a TypeSignature message. Also converts values to other types if specified.
                     * @param message TypeSignature
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.TypeSignature, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this TypeSignature to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for TypeSignature
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ValueSignature. */
                interface IValueSignature {

                    /** ValueSignature tpe */
                    tpe?: (scala.meta.internal.semanticdb.IType|null);
                }

                /** Represents a ValueSignature. */
                class ValueSignature implements IValueSignature {

                    /**
                     * Constructs a new ValueSignature.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IValueSignature);

                    /** ValueSignature tpe. */
                    public tpe?: (scala.meta.internal.semanticdb.IType|null);

                    /**
                     * Creates a new ValueSignature instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ValueSignature instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IValueSignature): scala.meta.internal.semanticdb.ValueSignature;

                    /**
                     * Encodes the specified ValueSignature message. Does not implicitly {@link scala.meta.internal.semanticdb.ValueSignature.verify|verify} messages.
                     * @param message ValueSignature message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IValueSignature, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ValueSignature message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ValueSignature.verify|verify} messages.
                     * @param message ValueSignature message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IValueSignature, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ValueSignature message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ValueSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.ValueSignature;

                    /**
                     * Decodes a ValueSignature message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ValueSignature
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.ValueSignature;

                    /**
                     * Verifies a ValueSignature message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ValueSignature message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ValueSignature
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.ValueSignature;

                    /**
                     * Creates a plain object from a ValueSignature message. Also converts values to other types if specified.
                     * @param message ValueSignature
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.ValueSignature, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ValueSignature to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ValueSignature
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SymbolInformation. */
                interface ISymbolInformation {

                    /** SymbolInformation symbol */
                    symbol?: (string|null);

                    /** SymbolInformation language */
                    language?: (scala.meta.internal.semanticdb.Language|null);

                    /** SymbolInformation kind */
                    kind?: (scala.meta.internal.semanticdb.SymbolInformation.Kind|null);

                    /** SymbolInformation properties */
                    properties?: (number|null);

                    /** SymbolInformation displayName */
                    displayName?: (string|null);

                    /** SymbolInformation signature */
                    signature?: (scala.meta.internal.semanticdb.ISignature|null);

                    /** SymbolInformation annotations */
                    annotations?: (scala.meta.internal.semanticdb.IAnnotationTree[]|null);

                    /** SymbolInformation access */
                    access?: (scala.meta.internal.semanticdb.IAccess|null);

                    /** SymbolInformation overriddenSymbols */
                    overriddenSymbols?: (string[]|null);

                    /** SymbolInformation documentation */
                    documentation?: (scala.meta.internal.semanticdb.IDocumentation|null);
                }

                /** Represents a SymbolInformation. */
                class SymbolInformation implements ISymbolInformation {

                    /**
                     * Constructs a new SymbolInformation.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ISymbolInformation);

                    /** SymbolInformation symbol. */
                    public symbol: string;

                    /** SymbolInformation language. */
                    public language: scala.meta.internal.semanticdb.Language;

                    /** SymbolInformation kind. */
                    public kind: scala.meta.internal.semanticdb.SymbolInformation.Kind;

                    /** SymbolInformation properties. */
                    public properties: number;

                    /** SymbolInformation displayName. */
                    public displayName: string;

                    /** SymbolInformation signature. */
                    public signature?: (scala.meta.internal.semanticdb.ISignature|null);

                    /** SymbolInformation annotations. */
                    public annotations: scala.meta.internal.semanticdb.IAnnotationTree[];

                    /** SymbolInformation access. */
                    public access?: (scala.meta.internal.semanticdb.IAccess|null);

                    /** SymbolInformation overriddenSymbols. */
                    public overriddenSymbols: string[];

                    /** SymbolInformation documentation. */
                    public documentation?: (scala.meta.internal.semanticdb.IDocumentation|null);

                    /**
                     * Creates a new SymbolInformation instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SymbolInformation instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ISymbolInformation): scala.meta.internal.semanticdb.SymbolInformation;

                    /**
                     * Encodes the specified SymbolInformation message. Does not implicitly {@link scala.meta.internal.semanticdb.SymbolInformation.verify|verify} messages.
                     * @param message SymbolInformation message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ISymbolInformation, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SymbolInformation message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.SymbolInformation.verify|verify} messages.
                     * @param message SymbolInformation message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ISymbolInformation, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SymbolInformation message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SymbolInformation
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.SymbolInformation;

                    /**
                     * Decodes a SymbolInformation message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SymbolInformation
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.SymbolInformation;

                    /**
                     * Verifies a SymbolInformation message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SymbolInformation message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SymbolInformation
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.SymbolInformation;

                    /**
                     * Creates a plain object from a SymbolInformation message. Also converts values to other types if specified.
                     * @param message SymbolInformation
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.SymbolInformation, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SymbolInformation to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SymbolInformation
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace SymbolInformation {

                    /** Kind enum. */
                    enum Kind {
                        UNKNOWN_KIND = 0,
                        LOCAL = 19,
                        FIELD = 20,
                        METHOD = 3,
                        CONSTRUCTOR = 21,
                        MACRO = 6,
                        TYPE = 7,
                        PARAMETER = 8,
                        SELF_PARAMETER = 17,
                        TYPE_PARAMETER = 9,
                        OBJECT = 10,
                        PACKAGE = 11,
                        PACKAGE_OBJECT = 12,
                        CLASS = 13,
                        TRAIT = 14,
                        INTERFACE = 18,
                        MESSAGE = 22,
                        PROTOBUF_ENUM = 23,
                        PROTOBUF_ENUM_VALUE = 24,
                        SERVICE = 25,
                        RPC = 26,
                        ONEOF = 27,
                        FILE = 28
                    }

                    /** Property enum. */
                    enum Property {
                        UNKNOWN_PROPERTY = 0,
                        ABSTRACT = 4,
                        FINAL = 8,
                        SEALED = 16,
                        IMPLICIT = 32,
                        LAZY = 64,
                        CASE = 128,
                        COVARIANT = 256,
                        CONTRAVARIANT = 512,
                        VAL = 1024,
                        VAR = 2048,
                        STATIC = 4096,
                        PRIMARY = 8192,
                        ENUM = 16384,
                        DEFAULT = 32768,
                        GIVEN = 65536,
                        INLINE = 131072,
                        OPEN = 262144,
                        TRANSPARENT = 524288,
                        INFIX = 1048576,
                        OPAQUE = 2097152,
                        OVERRIDE = 4194304,
                        SYNTHETIC = 8388608
                    }
                }

                /** Properties of a Documentation. */
                interface IDocumentation {

                    /** Documentation message */
                    message?: (string|null);

                    /** Documentation format */
                    format?: (scala.meta.internal.semanticdb.Documentation.Format|null);
                }

                /** Represents a Documentation. */
                class Documentation implements IDocumentation {

                    /**
                     * Constructs a new Documentation.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IDocumentation);

                    /** Documentation message. */
                    public message: string;

                    /** Documentation format. */
                    public format: scala.meta.internal.semanticdb.Documentation.Format;

                    /**
                     * Creates a new Documentation instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Documentation instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IDocumentation): scala.meta.internal.semanticdb.Documentation;

                    /**
                     * Encodes the specified Documentation message. Does not implicitly {@link scala.meta.internal.semanticdb.Documentation.verify|verify} messages.
                     * @param message Documentation message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IDocumentation, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Documentation message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Documentation.verify|verify} messages.
                     * @param message Documentation message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IDocumentation, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Documentation message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Documentation
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.Documentation;

                    /**
                     * Decodes a Documentation message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Documentation
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.Documentation;

                    /**
                     * Verifies a Documentation message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Documentation message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Documentation
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.Documentation;

                    /**
                     * Creates a plain object from a Documentation message. Also converts values to other types if specified.
                     * @param message Documentation
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.Documentation, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Documentation to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Documentation
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace Documentation {

                    /** Format enum. */
                    enum Format {
                        HTML = 0,
                        MARKDOWN = 1,
                        JAVADOC = 2,
                        SCALADOC = 3,
                        KDOC = 4
                    }
                }

                /** Properties of an AnnotationTree. */
                interface IAnnotationTree {

                    /** AnnotationTree tpe */
                    tpe?: (scala.meta.internal.semanticdb.IType|null);

                    /** AnnotationTree arguments */
                    "arguments"?: (scala.meta.internal.semanticdb.ITree[]|null);
                }

                /** Represents an AnnotationTree. */
                class AnnotationTree implements IAnnotationTree {

                    /**
                     * Constructs a new AnnotationTree.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IAnnotationTree);

                    /** AnnotationTree tpe. */
                    public tpe?: (scala.meta.internal.semanticdb.IType|null);

                    /** AnnotationTree arguments. */
                    public arguments: scala.meta.internal.semanticdb.ITree[];

                    /**
                     * Creates a new AnnotationTree instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AnnotationTree instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IAnnotationTree): scala.meta.internal.semanticdb.AnnotationTree;

                    /**
                     * Encodes the specified AnnotationTree message. Does not implicitly {@link scala.meta.internal.semanticdb.AnnotationTree.verify|verify} messages.
                     * @param message AnnotationTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IAnnotationTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AnnotationTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.AnnotationTree.verify|verify} messages.
                     * @param message AnnotationTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IAnnotationTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AnnotationTree message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AnnotationTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.AnnotationTree;

                    /**
                     * Decodes an AnnotationTree message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AnnotationTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.AnnotationTree;

                    /**
                     * Verifies an AnnotationTree message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AnnotationTree message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AnnotationTree
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.AnnotationTree;

                    /**
                     * Creates a plain object from an AnnotationTree message. Also converts values to other types if specified.
                     * @param message AnnotationTree
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.AnnotationTree, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AnnotationTree to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AnnotationTree
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an AssignTree. */
                interface IAssignTree {

                    /** AssignTree lhs */
                    lhs?: (scala.meta.internal.semanticdb.ITree|null);

                    /** AssignTree rhs */
                    rhs?: (scala.meta.internal.semanticdb.ITree|null);
                }

                /** Represents an AssignTree. */
                class AssignTree implements IAssignTree {

                    /**
                     * Constructs a new AssignTree.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IAssignTree);

                    /** AssignTree lhs. */
                    public lhs?: (scala.meta.internal.semanticdb.ITree|null);

                    /** AssignTree rhs. */
                    public rhs?: (scala.meta.internal.semanticdb.ITree|null);

                    /**
                     * Creates a new AssignTree instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns AssignTree instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IAssignTree): scala.meta.internal.semanticdb.AssignTree;

                    /**
                     * Encodes the specified AssignTree message. Does not implicitly {@link scala.meta.internal.semanticdb.AssignTree.verify|verify} messages.
                     * @param message AssignTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IAssignTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified AssignTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.AssignTree.verify|verify} messages.
                     * @param message AssignTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IAssignTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an AssignTree message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns AssignTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.AssignTree;

                    /**
                     * Decodes an AssignTree message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns AssignTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.AssignTree;

                    /**
                     * Verifies an AssignTree message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an AssignTree message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns AssignTree
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.AssignTree;

                    /**
                     * Creates a plain object from an AssignTree message. Also converts values to other types if specified.
                     * @param message AssignTree
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.AssignTree, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this AssignTree to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for AssignTree
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an Access. */
                interface IAccess {

                    /** Access privateAccess */
                    privateAccess?: (scala.meta.internal.semanticdb.IPrivateAccess|null);

                    /** Access privateThisAccess */
                    privateThisAccess?: (scala.meta.internal.semanticdb.IPrivateThisAccess|null);

                    /** Access privateWithinAccess */
                    privateWithinAccess?: (scala.meta.internal.semanticdb.IPrivateWithinAccess|null);

                    /** Access protectedAccess */
                    protectedAccess?: (scala.meta.internal.semanticdb.IProtectedAccess|null);

                    /** Access protectedThisAccess */
                    protectedThisAccess?: (scala.meta.internal.semanticdb.IProtectedThisAccess|null);

                    /** Access protectedWithinAccess */
                    protectedWithinAccess?: (scala.meta.internal.semanticdb.IProtectedWithinAccess|null);

                    /** Access publicAccess */
                    publicAccess?: (scala.meta.internal.semanticdb.IPublicAccess|null);
                }

                /** Represents an Access. */
                class Access implements IAccess {

                    /**
                     * Constructs a new Access.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IAccess);

                    /** Access privateAccess. */
                    public privateAccess?: (scala.meta.internal.semanticdb.IPrivateAccess|null);

                    /** Access privateThisAccess. */
                    public privateThisAccess?: (scala.meta.internal.semanticdb.IPrivateThisAccess|null);

                    /** Access privateWithinAccess. */
                    public privateWithinAccess?: (scala.meta.internal.semanticdb.IPrivateWithinAccess|null);

                    /** Access protectedAccess. */
                    public protectedAccess?: (scala.meta.internal.semanticdb.IProtectedAccess|null);

                    /** Access protectedThisAccess. */
                    public protectedThisAccess?: (scala.meta.internal.semanticdb.IProtectedThisAccess|null);

                    /** Access protectedWithinAccess. */
                    public protectedWithinAccess?: (scala.meta.internal.semanticdb.IProtectedWithinAccess|null);

                    /** Access publicAccess. */
                    public publicAccess?: (scala.meta.internal.semanticdb.IPublicAccess|null);

                    /** Access sealedValue. */
                    public sealedValue?: ("privateAccess"|"privateThisAccess"|"privateWithinAccess"|"protectedAccess"|"protectedThisAccess"|"protectedWithinAccess"|"publicAccess");

                    /**
                     * Creates a new Access instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Access instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IAccess): scala.meta.internal.semanticdb.Access;

                    /**
                     * Encodes the specified Access message. Does not implicitly {@link scala.meta.internal.semanticdb.Access.verify|verify} messages.
                     * @param message Access message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Access message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Access.verify|verify} messages.
                     * @param message Access message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an Access message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Access
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.Access;

                    /**
                     * Decodes an Access message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Access
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.Access;

                    /**
                     * Verifies an Access message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an Access message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Access
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.Access;

                    /**
                     * Creates a plain object from an Access message. Also converts values to other types if specified.
                     * @param message Access
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.Access, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Access to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Access
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a PrivateAccess. */
                interface IPrivateAccess {
                }

                /** Represents a PrivateAccess. */
                class PrivateAccess implements IPrivateAccess {

                    /**
                     * Constructs a new PrivateAccess.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IPrivateAccess);

                    /**
                     * Creates a new PrivateAccess instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns PrivateAccess instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IPrivateAccess): scala.meta.internal.semanticdb.PrivateAccess;

                    /**
                     * Encodes the specified PrivateAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.PrivateAccess.verify|verify} messages.
                     * @param message PrivateAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IPrivateAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified PrivateAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.PrivateAccess.verify|verify} messages.
                     * @param message PrivateAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IPrivateAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a PrivateAccess message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns PrivateAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.PrivateAccess;

                    /**
                     * Decodes a PrivateAccess message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns PrivateAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.PrivateAccess;

                    /**
                     * Verifies a PrivateAccess message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a PrivateAccess message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns PrivateAccess
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.PrivateAccess;

                    /**
                     * Creates a plain object from a PrivateAccess message. Also converts values to other types if specified.
                     * @param message PrivateAccess
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.PrivateAccess, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this PrivateAccess to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for PrivateAccess
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a PrivateThisAccess. */
                interface IPrivateThisAccess {
                }

                /** Represents a PrivateThisAccess. */
                class PrivateThisAccess implements IPrivateThisAccess {

                    /**
                     * Constructs a new PrivateThisAccess.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IPrivateThisAccess);

                    /**
                     * Creates a new PrivateThisAccess instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns PrivateThisAccess instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IPrivateThisAccess): scala.meta.internal.semanticdb.PrivateThisAccess;

                    /**
                     * Encodes the specified PrivateThisAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.PrivateThisAccess.verify|verify} messages.
                     * @param message PrivateThisAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IPrivateThisAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified PrivateThisAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.PrivateThisAccess.verify|verify} messages.
                     * @param message PrivateThisAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IPrivateThisAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a PrivateThisAccess message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns PrivateThisAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.PrivateThisAccess;

                    /**
                     * Decodes a PrivateThisAccess message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns PrivateThisAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.PrivateThisAccess;

                    /**
                     * Verifies a PrivateThisAccess message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a PrivateThisAccess message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns PrivateThisAccess
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.PrivateThisAccess;

                    /**
                     * Creates a plain object from a PrivateThisAccess message. Also converts values to other types if specified.
                     * @param message PrivateThisAccess
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.PrivateThisAccess, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this PrivateThisAccess to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for PrivateThisAccess
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a PrivateWithinAccess. */
                interface IPrivateWithinAccess {

                    /** PrivateWithinAccess symbol */
                    symbol?: (string|null);
                }

                /** Represents a PrivateWithinAccess. */
                class PrivateWithinAccess implements IPrivateWithinAccess {

                    /**
                     * Constructs a new PrivateWithinAccess.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IPrivateWithinAccess);

                    /** PrivateWithinAccess symbol. */
                    public symbol: string;

                    /**
                     * Creates a new PrivateWithinAccess instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns PrivateWithinAccess instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IPrivateWithinAccess): scala.meta.internal.semanticdb.PrivateWithinAccess;

                    /**
                     * Encodes the specified PrivateWithinAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.PrivateWithinAccess.verify|verify} messages.
                     * @param message PrivateWithinAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IPrivateWithinAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified PrivateWithinAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.PrivateWithinAccess.verify|verify} messages.
                     * @param message PrivateWithinAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IPrivateWithinAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a PrivateWithinAccess message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns PrivateWithinAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.PrivateWithinAccess;

                    /**
                     * Decodes a PrivateWithinAccess message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns PrivateWithinAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.PrivateWithinAccess;

                    /**
                     * Verifies a PrivateWithinAccess message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a PrivateWithinAccess message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns PrivateWithinAccess
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.PrivateWithinAccess;

                    /**
                     * Creates a plain object from a PrivateWithinAccess message. Also converts values to other types if specified.
                     * @param message PrivateWithinAccess
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.PrivateWithinAccess, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this PrivateWithinAccess to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for PrivateWithinAccess
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ProtectedAccess. */
                interface IProtectedAccess {
                }

                /** Represents a ProtectedAccess. */
                class ProtectedAccess implements IProtectedAccess {

                    /**
                     * Constructs a new ProtectedAccess.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IProtectedAccess);

                    /**
                     * Creates a new ProtectedAccess instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ProtectedAccess instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IProtectedAccess): scala.meta.internal.semanticdb.ProtectedAccess;

                    /**
                     * Encodes the specified ProtectedAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.ProtectedAccess.verify|verify} messages.
                     * @param message ProtectedAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IProtectedAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ProtectedAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ProtectedAccess.verify|verify} messages.
                     * @param message ProtectedAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IProtectedAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ProtectedAccess message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ProtectedAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.ProtectedAccess;

                    /**
                     * Decodes a ProtectedAccess message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ProtectedAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.ProtectedAccess;

                    /**
                     * Verifies a ProtectedAccess message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ProtectedAccess message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ProtectedAccess
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.ProtectedAccess;

                    /**
                     * Creates a plain object from a ProtectedAccess message. Also converts values to other types if specified.
                     * @param message ProtectedAccess
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.ProtectedAccess, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ProtectedAccess to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ProtectedAccess
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ProtectedThisAccess. */
                interface IProtectedThisAccess {
                }

                /** Represents a ProtectedThisAccess. */
                class ProtectedThisAccess implements IProtectedThisAccess {

                    /**
                     * Constructs a new ProtectedThisAccess.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IProtectedThisAccess);

                    /**
                     * Creates a new ProtectedThisAccess instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ProtectedThisAccess instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IProtectedThisAccess): scala.meta.internal.semanticdb.ProtectedThisAccess;

                    /**
                     * Encodes the specified ProtectedThisAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.ProtectedThisAccess.verify|verify} messages.
                     * @param message ProtectedThisAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IProtectedThisAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ProtectedThisAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ProtectedThisAccess.verify|verify} messages.
                     * @param message ProtectedThisAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IProtectedThisAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ProtectedThisAccess message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ProtectedThisAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.ProtectedThisAccess;

                    /**
                     * Decodes a ProtectedThisAccess message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ProtectedThisAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.ProtectedThisAccess;

                    /**
                     * Verifies a ProtectedThisAccess message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ProtectedThisAccess message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ProtectedThisAccess
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.ProtectedThisAccess;

                    /**
                     * Creates a plain object from a ProtectedThisAccess message. Also converts values to other types if specified.
                     * @param message ProtectedThisAccess
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.ProtectedThisAccess, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ProtectedThisAccess to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ProtectedThisAccess
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a ProtectedWithinAccess. */
                interface IProtectedWithinAccess {

                    /** ProtectedWithinAccess symbol */
                    symbol?: (string|null);
                }

                /** Represents a ProtectedWithinAccess. */
                class ProtectedWithinAccess implements IProtectedWithinAccess {

                    /**
                     * Constructs a new ProtectedWithinAccess.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IProtectedWithinAccess);

                    /** ProtectedWithinAccess symbol. */
                    public symbol: string;

                    /**
                     * Creates a new ProtectedWithinAccess instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ProtectedWithinAccess instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IProtectedWithinAccess): scala.meta.internal.semanticdb.ProtectedWithinAccess;

                    /**
                     * Encodes the specified ProtectedWithinAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.ProtectedWithinAccess.verify|verify} messages.
                     * @param message ProtectedWithinAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IProtectedWithinAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ProtectedWithinAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ProtectedWithinAccess.verify|verify} messages.
                     * @param message ProtectedWithinAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IProtectedWithinAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a ProtectedWithinAccess message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ProtectedWithinAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.ProtectedWithinAccess;

                    /**
                     * Decodes a ProtectedWithinAccess message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ProtectedWithinAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.ProtectedWithinAccess;

                    /**
                     * Verifies a ProtectedWithinAccess message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a ProtectedWithinAccess message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ProtectedWithinAccess
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.ProtectedWithinAccess;

                    /**
                     * Creates a plain object from a ProtectedWithinAccess message. Also converts values to other types if specified.
                     * @param message ProtectedWithinAccess
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.ProtectedWithinAccess, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ProtectedWithinAccess to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ProtectedWithinAccess
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a PublicAccess. */
                interface IPublicAccess {
                }

                /** Represents a PublicAccess. */
                class PublicAccess implements IPublicAccess {

                    /**
                     * Constructs a new PublicAccess.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IPublicAccess);

                    /**
                     * Creates a new PublicAccess instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns PublicAccess instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IPublicAccess): scala.meta.internal.semanticdb.PublicAccess;

                    /**
                     * Encodes the specified PublicAccess message. Does not implicitly {@link scala.meta.internal.semanticdb.PublicAccess.verify|verify} messages.
                     * @param message PublicAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IPublicAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified PublicAccess message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.PublicAccess.verify|verify} messages.
                     * @param message PublicAccess message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IPublicAccess, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a PublicAccess message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns PublicAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.PublicAccess;

                    /**
                     * Decodes a PublicAccess message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns PublicAccess
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.PublicAccess;

                    /**
                     * Verifies a PublicAccess message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a PublicAccess message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns PublicAccess
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.PublicAccess;

                    /**
                     * Creates a plain object from a PublicAccess message. Also converts values to other types if specified.
                     * @param message PublicAccess
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.PublicAccess, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this PublicAccess to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for PublicAccess
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SymbolOccurrence. */
                interface ISymbolOccurrence {

                    /** SymbolOccurrence range */
                    range?: (scala.meta.internal.semanticdb.IRange|null);

                    /** SymbolOccurrence symbol */
                    symbol?: (string|null);

                    /** SymbolOccurrence role */
                    role?: (scala.meta.internal.semanticdb.SymbolOccurrence.Role|null);
                }

                /** Represents a SymbolOccurrence. */
                class SymbolOccurrence implements ISymbolOccurrence {

                    /**
                     * Constructs a new SymbolOccurrence.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ISymbolOccurrence);

                    /** SymbolOccurrence range. */
                    public range?: (scala.meta.internal.semanticdb.IRange|null);

                    /** SymbolOccurrence symbol. */
                    public symbol: string;

                    /** SymbolOccurrence role. */
                    public role: scala.meta.internal.semanticdb.SymbolOccurrence.Role;

                    /**
                     * Creates a new SymbolOccurrence instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SymbolOccurrence instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ISymbolOccurrence): scala.meta.internal.semanticdb.SymbolOccurrence;

                    /**
                     * Encodes the specified SymbolOccurrence message. Does not implicitly {@link scala.meta.internal.semanticdb.SymbolOccurrence.verify|verify} messages.
                     * @param message SymbolOccurrence message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ISymbolOccurrence, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SymbolOccurrence message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.SymbolOccurrence.verify|verify} messages.
                     * @param message SymbolOccurrence message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ISymbolOccurrence, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SymbolOccurrence message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SymbolOccurrence
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.SymbolOccurrence;

                    /**
                     * Decodes a SymbolOccurrence message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SymbolOccurrence
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.SymbolOccurrence;

                    /**
                     * Verifies a SymbolOccurrence message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SymbolOccurrence message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SymbolOccurrence
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.SymbolOccurrence;

                    /**
                     * Creates a plain object from a SymbolOccurrence message. Also converts values to other types if specified.
                     * @param message SymbolOccurrence
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.SymbolOccurrence, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SymbolOccurrence to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SymbolOccurrence
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace SymbolOccurrence {

                    /** Role enum. */
                    enum Role {
                        UNKNOWN_ROLE = 0,
                        REFERENCE = 1,
                        DEFINITION = 2
                    }
                }

                /** Properties of a Diagnostic. */
                interface IDiagnostic {

                    /** Diagnostic range */
                    range?: (scala.meta.internal.semanticdb.IRange|null);

                    /** Diagnostic severity */
                    severity?: (scala.meta.internal.semanticdb.Diagnostic.Severity|null);

                    /** Diagnostic message */
                    message?: (string|null);
                }

                /** Represents a Diagnostic. */
                class Diagnostic implements IDiagnostic {

                    /**
                     * Constructs a new Diagnostic.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IDiagnostic);

                    /** Diagnostic range. */
                    public range?: (scala.meta.internal.semanticdb.IRange|null);

                    /** Diagnostic severity. */
                    public severity: scala.meta.internal.semanticdb.Diagnostic.Severity;

                    /** Diagnostic message. */
                    public message: string;

                    /**
                     * Creates a new Diagnostic instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Diagnostic instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IDiagnostic): scala.meta.internal.semanticdb.Diagnostic;

                    /**
                     * Encodes the specified Diagnostic message. Does not implicitly {@link scala.meta.internal.semanticdb.Diagnostic.verify|verify} messages.
                     * @param message Diagnostic message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IDiagnostic, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Diagnostic message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Diagnostic.verify|verify} messages.
                     * @param message Diagnostic message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IDiagnostic, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Diagnostic message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Diagnostic
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.Diagnostic;

                    /**
                     * Decodes a Diagnostic message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Diagnostic
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.Diagnostic;

                    /**
                     * Verifies a Diagnostic message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Diagnostic message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Diagnostic
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.Diagnostic;

                    /**
                     * Creates a plain object from a Diagnostic message. Also converts values to other types if specified.
                     * @param message Diagnostic
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.Diagnostic, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Diagnostic to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Diagnostic
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                namespace Diagnostic {

                    /** Severity enum. */
                    enum Severity {
                        UNKNOWN_SEVERITY = 0,
                        ERROR = 1,
                        WARNING = 2,
                        INFORMATION = 3,
                        HINT = 4
                    }
                }

                /** Properties of a Synthetic. */
                interface ISynthetic {

                    /** Synthetic range */
                    range?: (scala.meta.internal.semanticdb.IRange|null);

                    /** Synthetic tree */
                    tree?: (scala.meta.internal.semanticdb.ITree|null);
                }

                /** Represents a Synthetic. */
                class Synthetic implements ISynthetic {

                    /**
                     * Constructs a new Synthetic.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ISynthetic);

                    /** Synthetic range. */
                    public range?: (scala.meta.internal.semanticdb.IRange|null);

                    /** Synthetic tree. */
                    public tree?: (scala.meta.internal.semanticdb.ITree|null);

                    /**
                     * Creates a new Synthetic instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Synthetic instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ISynthetic): scala.meta.internal.semanticdb.Synthetic;

                    /**
                     * Encodes the specified Synthetic message. Does not implicitly {@link scala.meta.internal.semanticdb.Synthetic.verify|verify} messages.
                     * @param message Synthetic message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ISynthetic, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Synthetic message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Synthetic.verify|verify} messages.
                     * @param message Synthetic message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ISynthetic, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Synthetic message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Synthetic
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.Synthetic;

                    /**
                     * Decodes a Synthetic message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Synthetic
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.Synthetic;

                    /**
                     * Verifies a Synthetic message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Synthetic message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Synthetic
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.Synthetic;

                    /**
                     * Creates a plain object from a Synthetic message. Also converts values to other types if specified.
                     * @param message Synthetic
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.Synthetic, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Synthetic to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Synthetic
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a Tree. */
                interface ITree {

                    /** Tree applyTree */
                    applyTree?: (scala.meta.internal.semanticdb.IApplyTree|null);

                    /** Tree functionTree */
                    functionTree?: (scala.meta.internal.semanticdb.IFunctionTree|null);

                    /** Tree idTree */
                    idTree?: (scala.meta.internal.semanticdb.IIdTree|null);

                    /** Tree literalTree */
                    literalTree?: (scala.meta.internal.semanticdb.ILiteralTree|null);

                    /** Tree macroExpansionTree */
                    macroExpansionTree?: (scala.meta.internal.semanticdb.IMacroExpansionTree|null);

                    /** Tree originalTree */
                    originalTree?: (scala.meta.internal.semanticdb.IOriginalTree|null);

                    /** Tree selectTree */
                    selectTree?: (scala.meta.internal.semanticdb.ISelectTree|null);

                    /** Tree typeApplyTree */
                    typeApplyTree?: (scala.meta.internal.semanticdb.ITypeApplyTree|null);

                    /** Tree assignTree */
                    assignTree?: (scala.meta.internal.semanticdb.IAssignTree|null);

                    /** Tree annotationTree */
                    annotationTree?: (scala.meta.internal.semanticdb.IAnnotationTree|null);
                }

                /** Represents a Tree. */
                class Tree implements ITree {

                    /**
                     * Constructs a new Tree.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ITree);

                    /** Tree applyTree. */
                    public applyTree?: (scala.meta.internal.semanticdb.IApplyTree|null);

                    /** Tree functionTree. */
                    public functionTree?: (scala.meta.internal.semanticdb.IFunctionTree|null);

                    /** Tree idTree. */
                    public idTree?: (scala.meta.internal.semanticdb.IIdTree|null);

                    /** Tree literalTree. */
                    public literalTree?: (scala.meta.internal.semanticdb.ILiteralTree|null);

                    /** Tree macroExpansionTree. */
                    public macroExpansionTree?: (scala.meta.internal.semanticdb.IMacroExpansionTree|null);

                    /** Tree originalTree. */
                    public originalTree?: (scala.meta.internal.semanticdb.IOriginalTree|null);

                    /** Tree selectTree. */
                    public selectTree?: (scala.meta.internal.semanticdb.ISelectTree|null);

                    /** Tree typeApplyTree. */
                    public typeApplyTree?: (scala.meta.internal.semanticdb.ITypeApplyTree|null);

                    /** Tree assignTree. */
                    public assignTree?: (scala.meta.internal.semanticdb.IAssignTree|null);

                    /** Tree annotationTree. */
                    public annotationTree?: (scala.meta.internal.semanticdb.IAnnotationTree|null);

                    /** Tree sealedValue. */
                    public sealedValue?: ("applyTree"|"functionTree"|"idTree"|"literalTree"|"macroExpansionTree"|"originalTree"|"selectTree"|"typeApplyTree"|"assignTree"|"annotationTree");

                    /**
                     * Creates a new Tree instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns Tree instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ITree): scala.meta.internal.semanticdb.Tree;

                    /**
                     * Encodes the specified Tree message. Does not implicitly {@link scala.meta.internal.semanticdb.Tree.verify|verify} messages.
                     * @param message Tree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ITree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified Tree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.Tree.verify|verify} messages.
                     * @param message Tree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ITree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a Tree message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns Tree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.Tree;

                    /**
                     * Decodes a Tree message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns Tree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.Tree;

                    /**
                     * Verifies a Tree message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a Tree message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns Tree
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.Tree;

                    /**
                     * Creates a plain object from a Tree message. Also converts values to other types if specified.
                     * @param message Tree
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.Tree, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this Tree to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for Tree
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an ApplyTree. */
                interface IApplyTree {

                    /** ApplyTree function */
                    "function"?: (scala.meta.internal.semanticdb.ITree|null);

                    /** ApplyTree arguments */
                    "arguments"?: (scala.meta.internal.semanticdb.ITree[]|null);

                    /** ApplyTree properties */
                    properties?: (number|null);
                }

                /** Represents an ApplyTree. */
                class ApplyTree implements IApplyTree {

                    /**
                     * Constructs a new ApplyTree.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IApplyTree);

                    /** ApplyTree function. */
                    public function?: (scala.meta.internal.semanticdb.ITree|null);

                    /** ApplyTree arguments. */
                    public arguments: scala.meta.internal.semanticdb.ITree[];

                    /** ApplyTree properties. */
                    public properties: number;

                    /**
                     * Creates a new ApplyTree instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns ApplyTree instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IApplyTree): scala.meta.internal.semanticdb.ApplyTree;

                    /**
                     * Encodes the specified ApplyTree message. Does not implicitly {@link scala.meta.internal.semanticdb.ApplyTree.verify|verify} messages.
                     * @param message ApplyTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IApplyTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified ApplyTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.ApplyTree.verify|verify} messages.
                     * @param message ApplyTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IApplyTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an ApplyTree message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns ApplyTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.ApplyTree;

                    /**
                     * Decodes an ApplyTree message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns ApplyTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.ApplyTree;

                    /**
                     * Verifies an ApplyTree message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an ApplyTree message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns ApplyTree
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.ApplyTree;

                    /**
                     * Creates a plain object from an ApplyTree message. Also converts values to other types if specified.
                     * @param message ApplyTree
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.ApplyTree, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this ApplyTree to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for ApplyTree
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a FunctionTree. */
                interface IFunctionTree {

                    /** FunctionTree parameters */
                    parameters?: (scala.meta.internal.semanticdb.IIdTree[]|null);

                    /** FunctionTree body */
                    body?: (scala.meta.internal.semanticdb.ITree|null);
                }

                /** Represents a FunctionTree. */
                class FunctionTree implements IFunctionTree {

                    /**
                     * Constructs a new FunctionTree.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IFunctionTree);

                    /** FunctionTree parameters. */
                    public parameters: scala.meta.internal.semanticdb.IIdTree[];

                    /** FunctionTree body. */
                    public body?: (scala.meta.internal.semanticdb.ITree|null);

                    /**
                     * Creates a new FunctionTree instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns FunctionTree instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IFunctionTree): scala.meta.internal.semanticdb.FunctionTree;

                    /**
                     * Encodes the specified FunctionTree message. Does not implicitly {@link scala.meta.internal.semanticdb.FunctionTree.verify|verify} messages.
                     * @param message FunctionTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IFunctionTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified FunctionTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.FunctionTree.verify|verify} messages.
                     * @param message FunctionTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IFunctionTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a FunctionTree message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns FunctionTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.FunctionTree;

                    /**
                     * Decodes a FunctionTree message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns FunctionTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.FunctionTree;

                    /**
                     * Verifies a FunctionTree message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a FunctionTree message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns FunctionTree
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.FunctionTree;

                    /**
                     * Creates a plain object from a FunctionTree message. Also converts values to other types if specified.
                     * @param message FunctionTree
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.FunctionTree, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this FunctionTree to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for FunctionTree
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an IdTree. */
                interface IIdTree {

                    /** IdTree symbol */
                    symbol?: (string|null);
                }

                /** Represents an IdTree. */
                class IdTree implements IIdTree {

                    /**
                     * Constructs a new IdTree.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IIdTree);

                    /** IdTree symbol. */
                    public symbol: string;

                    /**
                     * Creates a new IdTree instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns IdTree instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IIdTree): scala.meta.internal.semanticdb.IdTree;

                    /**
                     * Encodes the specified IdTree message. Does not implicitly {@link scala.meta.internal.semanticdb.IdTree.verify|verify} messages.
                     * @param message IdTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IIdTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified IdTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.IdTree.verify|verify} messages.
                     * @param message IdTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IIdTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an IdTree message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns IdTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.IdTree;

                    /**
                     * Decodes an IdTree message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns IdTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.IdTree;

                    /**
                     * Verifies an IdTree message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an IdTree message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns IdTree
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.IdTree;

                    /**
                     * Creates a plain object from an IdTree message. Also converts values to other types if specified.
                     * @param message IdTree
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.IdTree, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this IdTree to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for IdTree
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a LiteralTree. */
                interface ILiteralTree {

                    /** LiteralTree constant */
                    constant?: (scala.meta.internal.semanticdb.IConstant|null);
                }

                /** Represents a LiteralTree. */
                class LiteralTree implements ILiteralTree {

                    /**
                     * Constructs a new LiteralTree.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ILiteralTree);

                    /** LiteralTree constant. */
                    public constant?: (scala.meta.internal.semanticdb.IConstant|null);

                    /**
                     * Creates a new LiteralTree instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns LiteralTree instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ILiteralTree): scala.meta.internal.semanticdb.LiteralTree;

                    /**
                     * Encodes the specified LiteralTree message. Does not implicitly {@link scala.meta.internal.semanticdb.LiteralTree.verify|verify} messages.
                     * @param message LiteralTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ILiteralTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified LiteralTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.LiteralTree.verify|verify} messages.
                     * @param message LiteralTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ILiteralTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a LiteralTree message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns LiteralTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.LiteralTree;

                    /**
                     * Decodes a LiteralTree message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns LiteralTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.LiteralTree;

                    /**
                     * Verifies a LiteralTree message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a LiteralTree message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns LiteralTree
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.LiteralTree;

                    /**
                     * Creates a plain object from a LiteralTree message. Also converts values to other types if specified.
                     * @param message LiteralTree
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.LiteralTree, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this LiteralTree to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for LiteralTree
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a MacroExpansionTree. */
                interface IMacroExpansionTree {

                    /** MacroExpansionTree beforeExpansion */
                    beforeExpansion?: (scala.meta.internal.semanticdb.ITree|null);

                    /** MacroExpansionTree tpe */
                    tpe?: (scala.meta.internal.semanticdb.IType|null);
                }

                /** Represents a MacroExpansionTree. */
                class MacroExpansionTree implements IMacroExpansionTree {

                    /**
                     * Constructs a new MacroExpansionTree.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IMacroExpansionTree);

                    /** MacroExpansionTree beforeExpansion. */
                    public beforeExpansion?: (scala.meta.internal.semanticdb.ITree|null);

                    /** MacroExpansionTree tpe. */
                    public tpe?: (scala.meta.internal.semanticdb.IType|null);

                    /**
                     * Creates a new MacroExpansionTree instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns MacroExpansionTree instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IMacroExpansionTree): scala.meta.internal.semanticdb.MacroExpansionTree;

                    /**
                     * Encodes the specified MacroExpansionTree message. Does not implicitly {@link scala.meta.internal.semanticdb.MacroExpansionTree.verify|verify} messages.
                     * @param message MacroExpansionTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IMacroExpansionTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified MacroExpansionTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.MacroExpansionTree.verify|verify} messages.
                     * @param message MacroExpansionTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IMacroExpansionTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a MacroExpansionTree message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns MacroExpansionTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.MacroExpansionTree;

                    /**
                     * Decodes a MacroExpansionTree message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns MacroExpansionTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.MacroExpansionTree;

                    /**
                     * Verifies a MacroExpansionTree message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a MacroExpansionTree message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns MacroExpansionTree
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.MacroExpansionTree;

                    /**
                     * Creates a plain object from a MacroExpansionTree message. Also converts values to other types if specified.
                     * @param message MacroExpansionTree
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.MacroExpansionTree, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this MacroExpansionTree to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for MacroExpansionTree
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of an OriginalTree. */
                interface IOriginalTree {

                    /** OriginalTree range */
                    range?: (scala.meta.internal.semanticdb.IRange|null);
                }

                /** Represents an OriginalTree. */
                class OriginalTree implements IOriginalTree {

                    /**
                     * Constructs a new OriginalTree.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.IOriginalTree);

                    /** OriginalTree range. */
                    public range?: (scala.meta.internal.semanticdb.IRange|null);

                    /**
                     * Creates a new OriginalTree instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns OriginalTree instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.IOriginalTree): scala.meta.internal.semanticdb.OriginalTree;

                    /**
                     * Encodes the specified OriginalTree message. Does not implicitly {@link scala.meta.internal.semanticdb.OriginalTree.verify|verify} messages.
                     * @param message OriginalTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.IOriginalTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified OriginalTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.OriginalTree.verify|verify} messages.
                     * @param message OriginalTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.IOriginalTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes an OriginalTree message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns OriginalTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.OriginalTree;

                    /**
                     * Decodes an OriginalTree message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns OriginalTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.OriginalTree;

                    /**
                     * Verifies an OriginalTree message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates an OriginalTree message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns OriginalTree
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.OriginalTree;

                    /**
                     * Creates a plain object from an OriginalTree message. Also converts values to other types if specified.
                     * @param message OriginalTree
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.OriginalTree, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this OriginalTree to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for OriginalTree
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a SelectTree. */
                interface ISelectTree {

                    /** SelectTree qualifier */
                    qualifier?: (scala.meta.internal.semanticdb.ITree|null);

                    /** SelectTree id */
                    id?: (scala.meta.internal.semanticdb.IIdTree|null);
                }

                /** Represents a SelectTree. */
                class SelectTree implements ISelectTree {

                    /**
                     * Constructs a new SelectTree.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ISelectTree);

                    /** SelectTree qualifier. */
                    public qualifier?: (scala.meta.internal.semanticdb.ITree|null);

                    /** SelectTree id. */
                    public id?: (scala.meta.internal.semanticdb.IIdTree|null);

                    /**
                     * Creates a new SelectTree instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns SelectTree instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ISelectTree): scala.meta.internal.semanticdb.SelectTree;

                    /**
                     * Encodes the specified SelectTree message. Does not implicitly {@link scala.meta.internal.semanticdb.SelectTree.verify|verify} messages.
                     * @param message SelectTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ISelectTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified SelectTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.SelectTree.verify|verify} messages.
                     * @param message SelectTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ISelectTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a SelectTree message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns SelectTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.SelectTree;

                    /**
                     * Decodes a SelectTree message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns SelectTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.SelectTree;

                    /**
                     * Verifies a SelectTree message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a SelectTree message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns SelectTree
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.SelectTree;

                    /**
                     * Creates a plain object from a SelectTree message. Also converts values to other types if specified.
                     * @param message SelectTree
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.SelectTree, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this SelectTree to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for SelectTree
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }

                /** Properties of a TypeApplyTree. */
                interface ITypeApplyTree {

                    /** TypeApplyTree function */
                    "function"?: (scala.meta.internal.semanticdb.ITree|null);

                    /** TypeApplyTree typeArguments */
                    typeArguments?: (scala.meta.internal.semanticdb.IType[]|null);
                }

                /** Represents a TypeApplyTree. */
                class TypeApplyTree implements ITypeApplyTree {

                    /**
                     * Constructs a new TypeApplyTree.
                     * @param [properties] Properties to set
                     */
                    constructor(properties?: scala.meta.internal.semanticdb.ITypeApplyTree);

                    /** TypeApplyTree function. */
                    public function?: (scala.meta.internal.semanticdb.ITree|null);

                    /** TypeApplyTree typeArguments. */
                    public typeArguments: scala.meta.internal.semanticdb.IType[];

                    /**
                     * Creates a new TypeApplyTree instance using the specified properties.
                     * @param [properties] Properties to set
                     * @returns TypeApplyTree instance
                     */
                    public static create(properties?: scala.meta.internal.semanticdb.ITypeApplyTree): scala.meta.internal.semanticdb.TypeApplyTree;

                    /**
                     * Encodes the specified TypeApplyTree message. Does not implicitly {@link scala.meta.internal.semanticdb.TypeApplyTree.verify|verify} messages.
                     * @param message TypeApplyTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encode(message: scala.meta.internal.semanticdb.ITypeApplyTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Encodes the specified TypeApplyTree message, length delimited. Does not implicitly {@link scala.meta.internal.semanticdb.TypeApplyTree.verify|verify} messages.
                     * @param message TypeApplyTree message or plain object to encode
                     * @param [writer] Writer to encode to
                     * @returns Writer
                     */
                    public static encodeDelimited(message: scala.meta.internal.semanticdb.ITypeApplyTree, writer?: $protobuf.Writer): $protobuf.Writer;

                    /**
                     * Decodes a TypeApplyTree message from the specified reader or buffer.
                     * @param reader Reader or buffer to decode from
                     * @param [length] Message length if known beforehand
                     * @returns TypeApplyTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): scala.meta.internal.semanticdb.TypeApplyTree;

                    /**
                     * Decodes a TypeApplyTree message from the specified reader or buffer, length delimited.
                     * @param reader Reader or buffer to decode from
                     * @returns TypeApplyTree
                     * @throws {Error} If the payload is not a reader or valid buffer
                     * @throws {$protobuf.util.ProtocolError} If required fields are missing
                     */
                    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): scala.meta.internal.semanticdb.TypeApplyTree;

                    /**
                     * Verifies a TypeApplyTree message.
                     * @param message Plain object to verify
                     * @returns `null` if valid, otherwise the reason why it is not
                     */
                    public static verify(message: { [k: string]: any }): (string|null);

                    /**
                     * Creates a TypeApplyTree message from a plain object. Also converts values to their respective internal types.
                     * @param object Plain object
                     * @returns TypeApplyTree
                     */
                    public static fromObject(object: { [k: string]: any }): scala.meta.internal.semanticdb.TypeApplyTree;

                    /**
                     * Creates a plain object from a TypeApplyTree message. Also converts values to other types if specified.
                     * @param message TypeApplyTree
                     * @param [options] Conversion options
                     * @returns Plain object
                     */
                    public static toObject(message: scala.meta.internal.semanticdb.TypeApplyTree, options?: $protobuf.IConversionOptions): { [k: string]: any };

                    /**
                     * Converts this TypeApplyTree to JSON.
                     * @returns JSON object
                     */
                    public toJSON(): { [k: string]: any };

                    /**
                     * Gets the default type url for TypeApplyTree
                     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
                     * @returns The default type url
                     */
                    public static getTypeUrl(typeUrlPrefix?: string): string;
                }
            }
        }
    }
}
