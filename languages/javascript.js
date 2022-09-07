/*
	Text Machine

	Copyright (c) 2018 - 2022 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



			/* A partial Javascript highlighter for Terminal-kit's TextBuffer */



const idleStyle = { color: 'white' } ;
const keywordStyle = { color: 'brightWhite' , bold: true } ;
const operatorStyle = { color: 'brightWhite' , bold: true } ;
const assignmentStyle = { color: 'brightWhite' , bold: true } ;
const thisStyle = { color: 'brightRed' , bold: true } ;
const constantKeywordStyle = { color: 'brightBlue' , bold: true } ;
const constantStyle = { color: 'brightBlue' } ;
const identifierStyle = { color: 'red' } ;
const numberStyle = { color: 'cyan' } ;
const stringStyle = { color: 'blue' } ;
const escapeStyle = { color: 'brightCyan' , bold: true } ;
const templatePlaceholderStyle = { color: 'brightCyan' , bold: true } ;
const commentStyle = { color: 'brightBlack' } ;
const propertyStyle = { color: 'green' } ;
const methodStyle = { color: 'brightYellow' } ;
const coreMethodStyle = { color: 'brightYellow' , bold: true } ;
const classStyle = { color: 'magenta' } ;
const coreClassOrObjectStyle = { color: 'brightMagenta' , bold: true } ;

const regexpStyle = { color: 'blue' } ;
const regexpDelemiterStyle = { color: 'brightMagenta' , bold: true } ;
const regexpParenthesisStyle = { color: 'yellow' , bold: true } ;
const regexpBracketStyle = { color: 'brightMagenta' , bold: true } ;
const regexpAlternativeStyle = { color: 'yellow' , bold: true } ;
const regexpMarkupStyle = { color: 'brightMagenta' } ;
const regexpClassStyle = { color: 'magenta' } ;
const regexpFlagStyle = { color: 'brightCyan' } ;

const parseErrorStyle = { color: 'brightWhite' , bgColor: 'red' , bold: true } ;
const braceStyle = { color: 'brightWhite' , bold: true } ;



const keywords = [
	'var' , 'let' , 'const' ,
	'do' , 'while' , 'for' , 'in' , 'of' , 'switch' , 'case' , 'default' , 'break' , 'continue' ,
	'if' , 'else' ,
	'function' , 'arguments' , 'async' , 'await' , 'return' , 'yield' ,
	'throw' , 'try' , 'catch' , 'finally' ,
	'new' , 'class' , 'extends' , 'static' , 'public' , 'protected' , 'private' , 'implements' , 'interface' , 'super' ,
	
	'typeof' , 'instanceof' ,
	'delete' ,
	'enum' , 'eval' , 'void' , 'with' , 
	
	'export' , 'import' , 'package' , 
	'debugger' ,
] ;

const operators = [
	'+' , '++' , '-' , '--' , '*' , '**' , '%' , // '/'
	'&&' , '||' , '!' , '!!' ,
	'==' , '===' , '!=' , '!==' , '<' , '<=' , '>' , '>=' ,
	'&' , '|' , '^' , '<<' , '>>' , '>>>' ,
	'??'
] ;

const assignments = [
	'=' ,
	'+=' , '-=' , '*=' , '%=' , // '/='
	'&=' , '|=' , '^='
] ;

const constantKeywords = [
	'true' , 'false' , 'null' , 'undefined' , 'Infinity' , 'NaN' ,

	// Node pseudo-constant
	'__filename' , '__dirname'
] ;

const coreMethods = [
	'setTimeout' , 'clearTimeout' , 'setInterval' , 'clearInterval' , 'setImmediate' , 'clearImmediate' ,
	'isNaN' , 'isFinite' , 'parseInt' , 'parseFloat' ,

	// Node
	'unref' , 'ref' , 'require'
] ;

const coreClassesOrObjects = [
	'Array' , 'Boolean' , 'Date' , 'Error' , 'Function' , 'Intl' , 'Math' , 'Number' , 'Object' , 'String' , 'RegExp' ,
	'EvalError' , 'RangeError' , 'ReferenceError' , 'SyntaxError' , 'TypeError' ,
	'ArrayBuffer' , 'Float32Array' , 'Float64Array' , 'Int16Array' , 'Int32Array' ,
	'Int8Array' , 'Uint16Array' , 'Uint32Array' , 'Uint8Array' ,

	// Common
	'console' , 'JSON' ,

	// Node
	'exports' , 'global' , 'module' ,
	'process' , 'Buffer' ,

	// Browser
	'window' , 'document' , 'Window' , 'Image' , 'DataView' , 'URIError'
] ;

const specialMember = [
	'prototype' , 'constructor'
] ;



const coreMethodHints = {
	setTimeout: 'timerID = setTimeout( callback , ms )' ,
	clearTimeout: 'clearTimeout( timerID )' ,
	setInterval: 'timerID = setInterval( callback , ms )' ,
	clearInterval: 'clearInterval( timerID )' ,
	parseInt: 'number = parseInt( string , radix )'
} ;





const prog = {
	hostConfig: {	// Accessible by the host
	} ,
	config: {
		initState: 'idle'
	} ,
	states: {
		idle: {
			action: [ 'style' , idleStyle ] ,
			branches: [
				{
					match: /^[a-zA-Z_$]/ ,
					state: 'identifier'
				} ,
				{
					match: /^[=.<>^?!&|~*%+-]/ ,
					state: 'operator'
				} ,
				{
					match: /^[0-9]/ ,
					state: 'number'
				} ,
				{
					match: "'" ,
					state: 'singleQuoteString'
				} ,
				{
					match: '"' ,
					state: 'doubleQuoteString'
				} ,
				{
					match: '`' ,
					state: 'templateString'
				} ,
				{
					match: '/' ,
					state: 'idleSlash'
				} ,
				{
					match: '{' ,
					subState: 'openBrace'
				} ,
				{
					match: '}' ,
					state: 'closeBrace'
				} ,
				{
					match: '[' ,
					subState: 'openBracket'
				} ,
				{
					match: ']' ,
					state: 'closeBracket'
				} ,
				{
					match: '(' ,
					subState: 'openParenthesis'
				} ,
				{
					match: ')' ,
					state: 'closeParenthesis'
				} ,
				{
					match: ':' ,
					state: 'colon' ,
				}
			]
		} ,
		// In the middle of an expression, after any constant/value/identifier/function call/etc...
		// Mostly like idle, except that slash can be divide sign instead of RegExp
		idleAfterValue: {
			action: [ 'style' , idleStyle ] ,	// action when this state is active at the end of the event
			branches: [
				{
					match: '/' ,
					state: 'idleAfterValueSlash'
				} ,
				{
					match: ' ' ,
					state: 'idleAfterValue'
				} ,
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		number: {
			action: [ 'style' , numberStyle ] ,
			branches: [
				{
					match: /^[0-9.]/ ,
					state: 'number'
				} ,
				{
					match: true ,
					state: 'idleAfterValue' ,
					propagate: true
				}
			]
		} ,
		identifier: {
			action: [ 'style' , identifierStyle ] ,
			span: 'identifier' ,
			branches: [
				{
					match: /^[a-zA-Z0-9_$]/ ,
					state: 'identifier'
				} ,
				{
					match: true ,
					state: 'afterIdentifier' ,
					propagate: true ,
				}
			] ,
			bufferBranches: [
				{
					match: 'this' ,
					action: [ 'spanStyle' , 'identifier' , thisStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true
				} ,
				{
					match: keywords ,
					action: [ 'spanStyle' , 'identifier' , keywordStyle ] ,
					state: 'idle' ,
					propagate: true
				} ,
				{
					match: constantKeywords ,
					action: [ 'spanStyle' , 'identifier' , constantKeywordStyle ] ,
					state: 'idleAfterValue' ,
					propagate: true
				} ,
				{
					match: coreMethods ,
					action: [ [ 'spanStyle' , 'identifier' , coreMethodStyle ] , [ 'hint' , coreMethodHints ] ] ,
					state: 'idle' ,
					propagate: true
				} ,
				{
					match: coreClassesOrObjects ,
					action: [ 'spanStyle' , 'identifier' , coreClassOrObjectStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true
				} ,
				{
					match: /^[A-Z][A-Z0-9_]+$/ ,
					action: [ 'spanStyle' , 'identifier' , constantStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true
				} ,
				{
					match: /^[A-Z]/ ,
					action: [ 'spanStyle' , 'identifier' , classStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true
				}
			]
		} ,
		afterIdentifier: {
			action: [ 'style' , idleStyle ] ,
			branches: [
				{
					match: ' ' ,
					state: 'afterIdentifier'
				} ,
				{
					match: '.' ,
					state: 'dotAfterIdentifier'
				} ,
				{
					match: ':' ,
					hasMicroState: 'ternary' ,
					state: 'colon'
				} ,
				{
					match: ':' ,
					action: [ 'spanStyle' , 'identifier' , propertyStyle ] ,
					state: 'colon'
				} ,
				{
					match: '(' ,
					subState: 'openParenthesis' ,
					action: [ 'spanStyle' , 'identifier' , methodStyle ]
				} ,
				{
					match: true ,
					state: 'idleAfterValue' ,
					propagate: true
				}
			]
		} ,
		dotAfterIdentifier: {
			action: [ 'style' , idleStyle ] ,
			branches: [
				{
					match: ' ' ,
					state: 'dotAfterIdentifier'
				} ,
				{
					match: /^[a-zA-Z_$]/ ,
					state: 'member'
				} ,
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		member: {
			action: [ 'style' , propertyStyle ] ,
			span: 'identifier' ,
			branches: [
				{
					match: /^[a-zA-Z0-9_$]/ ,
					state: 'member'
				} ,
				{
					match: true ,
					state: 'afterIdentifier' ,
					propagate: true ,
				}
			] ,
			bufferBranches: [
				{
					match: specialMember ,
					action: [ 'spanStyle' , 'identifier' , keywordStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true
				}
			]
		} ,



		operator: {
			action: [ 'style' , idleStyle ] ,
			span: 'operator' ,
			branches: [
				{
					match: /^[=.<>^?!&|~*%+-]/ ,
					state: 'operator'
				} ,
				{
					match: true ,
					state: 'idle' ,
					propagate: true ,
				}
			] ,
			bufferBranches: [
				{
					match: '?' ,
					action: [ 'spanStyle' , 'operator' , operatorStyle ] ,
					state: 'idle' ,
					microState: { ternary: true } ,
					propagate: true
				} ,
				{
					match: operators ,
					action: [ 'spanStyle' , 'operator' , operatorStyle ] ,
					state: 'idle' ,
					propagate: true
				} ,
				{
					match: assignments ,
					action: [ 'spanStyle' , 'operator' , assignmentStyle ] ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		colon: {
			action: [ 'style' , operatorStyle ] ,
			microState: { ternary: false } ,
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,






		singleQuoteString: {
			action: [ 'style' , stringStyle ] ,
			branches: [
				{
					match: '\\' ,
					subState: 'escape'
				} ,
				{
					match: /^['\n]/ ,
					state: 'idleAfterValue' ,
					delay: true
				}
			]
		} ,
		doubleQuoteString: {
			action: [ 'style' , stringStyle ] ,
			branches: [
				{
					match: '\\' ,
					subState: 'escape'
				} ,
				{
					match: /^["\n]/ ,
					state: 'idleAfterValue' ,
					delay: true
				}
			]
		} ,
		templateString: {
			action: [ 'style' , stringStyle ] ,
			branches: [
				{
					match: '\\' ,
					subState: 'escape'
				} ,
				{
					match: '`' ,
					state: 'idleAfterValue' ,
					delay: true
				} ,
				{
					match: '$' ,
					state: 'templatePlaceholder'
				}
			]
		} ,
		templatePlaceholder: {
			startSpan: true ,
			action: [ 'style' , templatePlaceholderStyle ] ,
			branches: [
				{
					match: '{' ,
					subState: 'openBrace' ,
					state: 'templateString'
				} ,
				{
					match: true ,
					action: [ 'spanStyle' , stringStyle ] ,
					//clearSpan: true ,
					state: 'templateString'
				}
			]
		} ,
		regexp: {
			action: [ 'style' , regexpStyle ] ,
			branches: [
				{
					match: '\\' ,
					subState: 'escape'
				} ,
				{
					match: /[.?+*^$]/ ,
					state: 'regexpMarkup'
				} ,
				{
					match: '[' ,
					state: 'regexpOpenBracket'
				} ,
				{
					match: '(' ,
					subState: 'regexpOpenParenthesis'
				} ,
				{
					match: ')' ,
					state: 'regexpCloseParenthesis'
				} ,
				{
					match: '|' ,
					state: 'regexpAlternative'
				} ,
				{
					match: '/' ,
					state: 'closeRegexp'
				}
			]
		} ,
		closeRegexp: {
			action: [ 'style' , regexpDelemiterStyle ] ,
			branches: [
				{
					match: true ,
					state: 'regexpFlag' ,
					propagate: true
				}
			]
		} ,
		regexpFlag: {
			action: [ 'style' , regexpFlagStyle ] ,
			branches: [
				{
					match: /[a-z]/ ,
					state: 'regexpFlag'
				} ,
				{
					match: true ,
					state: 'idleAfterValue' ,
					propagate: true
				}
			]
		} ,
		regexpMarkup: {
			action: [ 'style' , regexpMarkupStyle ] ,
			branches: [
				{
					match: true ,
					state: 'regexp' ,
					propagate: true
				}
			]
		} ,
		regexpAlternative: {
			action: [ 'style' , regexpAlternativeStyle ] ,
			branches: [
				{
					match: true ,
					state: 'regexp' ,
					propagate: true
				}
			]
		} ,
		regexpOpenParenthesis: {
			action: [ 'style' , parseErrorStyle ] ,
			branches: [
				{
					match: true ,
					state: 'regexp' ,
					propagate: true
				}
			]
		} ,
		regexpCloseParenthesis: {
			returnAfter: 'regexpOpenParenthesis' ,
			action: [ [ 'style' , regexpParenthesisStyle ] , [ 'openerStyle' , regexpParenthesisStyle ] ] ,
			returnErrorAction: [ 'style' , parseErrorStyle ] ,	// if not returning from 'openBrace', we've got a parseError
			branches: [
				{
					match: true ,
					state: 'regexp' ,
					propagate: true
				}
			]
		} ,
		regexpOpenBracket: {
			action: [ 'style' , regexpBracketStyle ] ,
			branches: [
				{
					match: true ,
					state: 'regexpClass' ,
					propagate: true
				}
			]
		} ,
		regexpClass: {
			action: [ 'style' , regexpClassStyle ] ,
			branches: [
				{
					match: '\\' ,
					subState: 'escape'
				} ,
				{
					match: ']' ,
					state: 'regexpCloseBracket'
				}
			]
		} ,
		regexpCloseBracket: {
			action: [ 'style' , regexpBracketStyle ] ,
			branches: [
				{
					match: true ,
					state: 'regexp' ,
					propagate: true
				}
			]
		} ,



		openBrace: {
			action: [ 'style' , parseErrorStyle ] ,
			//microState: { keyValuePair: true } ,
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeBrace: {
			returnAfter: 'openBrace' ,
			action: [ [ 'style' , braceStyle ] , [ 'openerStyle' , braceStyle ] ] ,
			returnErrorAction: [ 'style' , parseErrorStyle ] ,	// if not returning from 'openBrace', we've got a parseError
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		openBracket: {
			action: [ 'style' , parseErrorStyle ] ,
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeBracket: {
			returnAfter: 'openBracket' ,
			action: [ [ 'style' , braceStyle ] , [ 'openerStyle' , braceStyle ] ] ,
			returnErrorAction: [ 'style' , parseErrorStyle ] ,	// if not returning from 'openBrace', we've got a parseError
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		openParenthesis: {
			action: [ 'style' , parseErrorStyle ] ,
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeParenthesis: {
			returnAfter: 'openParenthesis' ,
			action: [ [ 'style' , braceStyle ] , [ 'openerStyle' , braceStyle ] ] ,
			returnErrorAction: [ 'style' , parseErrorStyle ] ,	// if not returning from 'openBrace', we've got a parseError
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,



		idleSlash: {
			action: [ 'style' , idleStyle ] ,
			branches: [
				{
					match: '/' ,
					state: 'lineComment' ,
					action: [ 'streakStyle' , commentStyle ]
				} ,
				{
					match: '*' ,
					state: 'multiLineComment' ,
					action: [ 'streakStyle' , commentStyle ]
				} ,
				{
					match: true ,
					state: 'regexp' ,
					propagate: true ,
					action: [ 'streakStyle' , regexpDelemiterStyle ]
				}
			]
		} ,
		idleAfterValueSlash: {
			action: [ 'style' , idleStyle ] ,
			branches: [
				{
					match: '/' ,
					state: 'lineComment' ,
					action: [ 'streakStyle' , commentStyle ]
				} ,
				{
					match: '*' ,
					state: 'multiLineComment' ,
					action: [ 'streakStyle' , commentStyle ]
				} ,
				{
					match: true ,
					state: 'idle'
				}
			]
		} ,
		lineComment: {
			action: [ 'style' , commentStyle ] ,
			branches: [
				{
					match: '\n' ,
					state: 'idle'
				}
			]
		} ,
		multiLineComment: {
			action: [ 'style' , commentStyle ] ,
			branches: [
				{
					match: '*' ,
					state: 'multiLineCommentAsterisk'
				}
			]
		} ,
		multiLineCommentAsterisk: {
			action: [ 'style' , commentStyle ] ,
			branches: [
				{
					match: '/' ,
					state: 'idle' ,
					delay: true
				} ,
				{
					match: true ,
					state: 'multiLineComment' ,
					propagate: true
				}
			]
		} ,






		escape: {
			action: [ 'style' , escapeStyle ] ,
			branches: [
				{
					match: true ,
					return: true ,
					state: 'idle' ,		// This is ignored if the current state can return
					delay: true
				}
			]
		}
	}
} ;



module.exports = prog ;

