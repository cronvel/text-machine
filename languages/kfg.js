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
const commentStyle = { color: 'gray' } ;
const propertyStyle = { color: 'green' } ;
const methodStyle = { color: 'brightYellow' } ;
const coreMethodStyle = { color: 'brightYellow' , bold: true } ;
const classStyle = { color: 'magenta' } ;
const constructorStyle = { color: 'magenta' } ;
const coreClassOrObjectStyle = { color: 'brightMagenta' , bold: true } ;

const regexpStyle = { color: 'blue' } ;
const regexpDelemiterStyle = { color: 'brightMagenta' , bold: true } ;
const regexpParenthesisStyle = { color: 'yellow' , bold: true } ;
const regexpBracketStyle = { color: 'brightMagenta' , bold: true } ;
const regexpAlternativeStyle = { color: 'yellow' , bold: true } ;
const regexpMarkupStyle = { color: 'brightMagenta' } ;
const regexpClassStyle = { color: 'cyan' } ;
const regexpClassRangeStyle = { color: 'magenta' } ;
const regexpFlagStyle = { color: 'green' } ;

const parseErrorStyle = { color: 'brightWhite' , bgColor: 'red' , bold: true } ;
const braceStyle = { color: 'brightWhite' , bold: true } ;



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
	states: {
		idle: {
			action: [ 'style' , idleStyle ] ,
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
			action: [ 'style' , commentStyle ] ,
			branches: [
				{
					match: '\n' ,
					state: 'idle'
				}
			]
		} ,
		maybeValueOrKey: {
			action: [ 'style' , idleStyle ] ,
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
							action: [ 'spanStyle' , 'maybeValueOrKey' , constantKeywordStyle ] ,
							state: 'idleAfterValue' ,
							propagate: true
						}
                    ]
				}
			]
		} ,
		maybeValueOrKeyNotConstant: {
			action: [ 'style' , idleStyle ] ,
			span: 'maybeValueOrKey' ,
			branches: [
				{
					match: '\n' ,
					state: 'idle'
				} ,
				{
					match: ':' ,
					action: [ 'spanStyle' , propertyStyle ] ,
					state: 'key'
				} ,
				{
					match: true ,
					state: 'maybeValueOrKeyNotConstant'
				} ,
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

