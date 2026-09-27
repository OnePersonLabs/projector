/** Declaration queries pinned to the grammars shipped by tree-sitter-wasm 0.3.1. */
export const DECLARATION_QUERIES: Record<string, string> = {
  python: ['function_definition', 'class_definition'].map(type => `(${type}) @declaration`).join('\n'),
  rust: ['function_item', 'struct_item', 'enum_item', 'trait_item', 'type_item', 'const_item', 'static_item', 'mod_item'].map(type => `(${type}) @declaration`).join('\n'),
  'c-sharp': ['class_declaration', 'interface_declaration', 'struct_declaration', 'enum_declaration', 'method_declaration', 'property_declaration', 'record_declaration', 'delegate_declaration'].map(type => `(${type}) @declaration`).join('\n'),
};
