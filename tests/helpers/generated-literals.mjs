import ts from 'typescript';
/** Read generated constants independent of compiler-selected JS quoting. */
export function findGeneratedInitializer(source,name){const ast=ts.createSourceFile('generated.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let found;function visit(node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text===name)found=node.initializer;if(!found)ts.forEachChild(node,visit);}visit(ast);if(!found)throw new Error('Missing generated constant '+name);return found;}
export function readGeneratedString(source,name){const node=findGeneratedInitializer(source,name);if(!ts.isStringLiteralLike(node))throw new Error('Expected generated string '+name);return node.text;}
