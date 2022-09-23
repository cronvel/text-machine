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



			/* KFG (Kung-Fig) */






const constantKeywords = [
	'null' ,
	'true' , 'false' , 'on' , 'off' , 'yes' , 'no' ,
	'NaN' , 'Infinity' , '-Infinity'
] ;



const prog = {
	hostConfig: {	// Accessible by the host
	} ,
	config: {
		initState: 'idle'
	} ,
	styles: {
		idle: { color: 'white' } ,
		keyword: { color: 'brightWhite' , bold: true } ,
		operator: { color: 'brightWhite' , bold: true } ,
		assignment: { color: 'brightWhite' , bold: true } ,
		this: { color: 'brightRed' , bold: true } ,
		constantKeyword: { color: 'brightBlue' , bold: true } ,
		constant: { color: 'brightBlue' } ,
		identifier: { color: 'red' } ,
		number: { color: 'cyan' } ,
		string: { color: 'blue' } ,
		escape: { color: 'brightCyan' , bold: true } ,
		templatePlaceholder: { color: 'brightCyan' , bold: true } ,
		comment: { color: 'gray' } ,
		property: { color: 'green' } ,
		method: { color: 'brightYellow' } ,
		coreMethod: { color: 'brightYellow' , bold: true } ,
		class: { color: 'magenta' } ,
		constructor: { color: 'magenta' } ,
		coreClassOrObject: { color: 'brightMagenta' , bold: true } ,

		regexp: { color: 'blue' } ,
		regexpDelemiter: { color: 'brightMagenta' , bold: true } ,
		regexpParenthesis: { color: 'yellow' , bold: true } ,
		regexpBracket: { color: 'brightMagenta' , bold: true } ,
		regexpAlternative: { color: 'yellow' , bold: true } ,
		regexpMarkup: { color: 'brightMagenta' } ,
		regexpClass: { color: 'cyan' } ,
		regexpClassRange: { color: 'magenta' } ,
		regexpFlag: { color: 'green' } ,

		parseError: { color: 'brightWhite' , bgColor: 'red' , bold: true } ,
		brace: { color: 'brightWhite' , bold: true } 
	} ,
	states: {
		idle: {
			action: [ 'style' , 'idle' ] ,
			branches: [
				{
					match: /[ \t\n]/ ,
					state: 'idle'
				} ,
				{
					match: '#' ,
					state: 'comment'
				} ,
				{
					match: '(' ,
					state: 'openOperator'
				} ,
				{
					match: '@' ,
					state: 'includeMark'
				} ,
				{
					match: '-' ,
					state: 'item'
				} ,
				{
					match: '[' ,
					state: 'openTag'
				} ,
				{
					match: '>' ,
					state: 'stringIntroducer'
				} ,
				{
					match: '$' ,
					state: 'maybeTemplate'
				} ,
				{
					match: '<' ,
					state: 'maybeClassOrMapKey'
				} ,
				{
					match: ':' ,
					state: 'maybeMapValue'
				} ,
				{
					match: '"' ,
					state: 'maybeValueOrDoubleQuotedKey'
				} ,
				{
					match: true ,
					state: 'maybeValueOrKey'
				}
			]
		} ,
		comment: {
			action: [ 'style' , 'comment' ] ,
			branches: [
				{
					match: '\n' ,
					state: 'idle'
				}
			]
		} ,
		maybeValueOrKey: {
			action: [ 'style' , 'idle' ] ,
			span: 'key' ,
			branches: [
				{
					match: /[a-zA-Z-]/ ,
					state: 'maybeValueOrKey'
				} ,
				{
					match: true ,
					state: 'maybeValueOrKeyNotConstant' ,
					
					branchOn: 'identifier' ,
                    spanBranches: [
                    	{
							match: constantKeywords ,
							action: [ 'spanStyle' , 'maybeValueOrKey' , 'constantKeyword' ] ,
							state: 'idleAfterValue' ,
							propagate: true
						}
                    ]
				}
			]
		} ,
		maybeValueOrKeyNotConstant: {
			action: [ 'style' , 'idle' ] ,
			span: 'maybeValueOrKey' ,
			branches: [
				{
					match: '\n' ,
					state: 'idle'
				} ,
				{
					match: ':' ,
					action: [ 'spanStyle' , 'property' ] ,
					state: 'key'
				} ,
				{
					match: true ,
					state: 'maybeValueOrKeyNotConstant'
				} ,
			]
		} ,





		escape: {
			action: [ 'style' , 'escape' ] ,
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

