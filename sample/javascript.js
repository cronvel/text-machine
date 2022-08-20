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
const thisStyle = { color: 'brightRed' , bold: true } ;
const constantKeywordStyle = { color: 'brightBlue' , bold: true } ;
const constantStyle = { color: 'brightBlue' } ;
const identifierStyle = { color: 'red' } ;
const numberStyle = { color: 'cyan' } ;
const stringStyle = { color: 'blue' } ;
const escapeStyle = { color: 'brightCyan' , bold: true } ;
const templatePlaceholderStyle = { color: 'brightCyan' , bold: true } ;
const regexpStyle = { color: 'blue' } ;
const commentStyle = { color: 'brightBlack' } ;
const propertyStyle = { color: 'green' } ;
const methodStyle = { color: 'brightYellow' } ;
const coreMethodStyle = { color: 'brightYellow' , bold: true } ;
const classStyle = { color: 'magenta' } ;
const coreClassOrObjectStyle = { color: 'brightMagenta' , bold: true } ;

const parseErrorStyle = { color: 'brightWhite' , bgColor: 'red' , bold: true } ;
const braceStyle = { color: 'brightWhite' , bold: true } ;



const keywords = [
	'do' , 'if' , 'in' , 'for' , 'let' , 'new' , 'try' , 'var' , 'case' , 'else' , 'enum' ,
	'eval' , 'void' , 'with' , 'await' , 'break' , 'catch' , 'class' , 'const' ,
	'super' , 'throw' , 'while' , 'yield' , 'delete' , 'export' , 'import' , 'public' , 'return' ,
	'static' , 'switch' , 'typeof' , 'default' , 'extends' , 'finally' , 'package' , 'private' ,
	'continue' , 'debugger' , 'function' , 'arguments' , 'interface' , 'protected' , 'implements' , 'instanceof' ,

	// Node pseudo keywords
	'exports' , 'global' , 'module' , 'require' , '__filename' , '__dirname'
] ;

const constantKeywords = [
	'true' , 'false' , 'null' , 'undefined' , 'Infinity' , 'NaN'
] ;

const coreMethods = [
	'setTimeout' , 'clearTimeout' , 'setInterval' , 'clearInterval' , 'setImmediate' , 'clearImmediate' ,
	'isNaN' , 'isFinite' , 'parseInt' , 'parseFloat' ,

	// Node
	'unref' , 'ref'
] ;

const coreClassesOrObjects = [
	'Array' , 'Boolean' , 'Date' , 'Error' , 'Function' , 'Intl' , 'Math' , 'Number' , 'Object' , 'String' , 'RegExp' ,
	'EvalError' , 'RangeError' , 'ReferenceError' , 'SyntaxError' , 'TypeError' ,
	'ArrayBuffer' , 'Float32Array' , 'Float64Array' , 'Int16Array' , 'Int32Array' ,
	'Int8Array' , 'Uint16Array' , 'Uint32Array' , 'Uint8Array' ,

	// Common
	'console' , 'JSON' ,

	// Node
	'process' , 'Buffer' ,

	// Browser
	'window' , 'document' , 'Window' , 'Image' , 'DataView' , 'URIError'
] ;

const memberKeywords = [
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
	states: {	// Every states of the machine
		idle: {
			action: [ 'style' , idleStyle ] ,	// action when this state is active at the end of the event
			bufferBranches: false ,					// if an array, this state start buffering as long as it last
			//checkpoint: true ,	// true if the past will not have influence on the future anymore: help optimizing the host
			branches: [
				{
					match: /^[a-zA-Z_$]/ ,	// the event should match this to trigger those actions
					state: 'identifier' ,	// next state

					propagate: false ,		// eat the event or propagate it immediately to the next state?
					action: null ,			// action at trigger time, run before the action of the next state
					delay: false 			// for this time, the old state action will be executed rather than the new one
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
				}
			]
		} ,
		// In the middle of an expression, after any constant/value/identifier/function call/etc...
		// Mostly like idle, except that slash can be divide sign instead of RegExp
		idleExpression: {
			action: [ 'style' , idleStyle ] ,	// action when this state is active at the end of the event
			branches: [
				{
					match: /^[a-zA-Z_$]/ ,	// the event should match this to trigger those actions
					state: 'identifier' ,	// next state
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
					state: 'idleExpressionSlash'
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
					state: 'idle' ,
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
			// Buffers are checked on state switching
			bufferBranches: [
				{
					match: 'this' ,
					// replace the 'action' of the event, also work with any properties of the event except 'match' BTW
					//action: [ 'streakStyle' , thisStyle ] ,
					action: [ 'spanStyle' , 'identifier' , thisStyle ] ,
					state: 'afterIdentifier'
					//propagate: true ,
				} ,
				{
					match: keywords ,
					//action: [ 'streakStyle' , keywordStyle ] ,
					action: [ 'spanStyle' , 'identifier' , keywordStyle ] ,
					state: 'idle'
				} ,
				{
					match: constantKeywords ,
					//action: [ 'streakStyle' , constantKeywordStyle ] ,
					action: [ 'spanStyle' , 'identifier' , constantKeywordStyle ] ,
					state: 'idle'
				} ,
				{
					match: coreMethods ,
					//action: [ [ 'streakStyle' , coreMethodStyle ] , [ 'hint' , coreMethodHints ] ] ,
					action: [ [ 'spanStyle' , 'identifier' , coreMethodStyle ] , [ 'hint' , coreMethodHints ] ] ,
					state: 'idle'
				} ,
				{
					match: coreClassesOrObjects ,
					//action: [ 'streakStyle' , coreClassOrObjectStyle ] ,
					action: [ 'spanStyle' , 'identifier' , coreClassOrObjectStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true ,
				} ,
				{
					match: /^[A-Z][A-Z0-9_]+$/ ,
					//action: [ 'streakStyle' , constantStyle ] ,
					action: [ 'spanStyle' , 'identifier' , constantStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true ,
				} ,
				{
					match: /^[A-Z]/ ,
					//action: [ 'streakStyle' , classStyle ] ,
					action: [ 'spanStyle' , 'identifier' , classStyle ] ,
					state: 'afterIdentifier' ,
					propagate: true ,
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
					match: '(' ,
					subState: 'openParenthesis' ,
					action: [ 'spanStyle' , 'identifier' , methodStyle ]
				} ,
				{
					match: true ,
					state: 'idle' ,
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
			// Checked when an event would change the state
			bufferBranches: [
				{
					match: memberKeywords ,
					// replace the 'action' of the event, also work with any properties of the event except 'match' BTW
					//action: [ 'streakStyle' , keywordStyle ] ,
					action: [ 'spanStyle' , 'identifier' , keywordStyle ] ,
					state: 'afterIdentifier' ,
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
					state: 'idle' ,
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
					state: 'idle' ,
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
					state: 'idle' ,
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
					match: '/' ,
					state: 'regexpFlag' ,
					delay: true
				}
			]
		} ,
		regexpFlag: {
			action: [ 'style' , regexpStyle ] ,
			branches: [
				{
					match: /[a-z]/ ,
					state: 'regexpFlag' ,
					delay: true
				} ,
				{
					match: true ,
					state: 'idle' ,
					delay: true
				}
			]
		} ,



		openBrace: {
			action: [ 'style' , parseErrorStyle ] ,
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
					action: [ 'streakStyle' , regexpStyle ] ,
					propagate: true
				}
			]
		} ,
		idleExpressionSlash: {
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

