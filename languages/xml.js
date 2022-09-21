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



/* A XML parser */



const idleStyle = { color: 'white' } ;
const operatorStyle = { color: 'brightWhite' , bold: true } ;

// <? ... ?>
const declarationTagStyle = { color: 'brightMagenta' } ;
const declarationTagNameStyle = { color: 'magenta' } ;
const declarationTagAttributeNameStyle = { color: 'magenta' } ;

// <! ... >
const definitionTagStyle = { color: 'brightMagenta' } ;
const definitionTagNameStyle = { color: 'magenta' } ;
const definitionTagAttributeNameStyle = { color: 'magenta' } ;
const definitionTagBracketStyle = { color: 'brightMagenta' , bold: true } ;

const tagStyle = { color: 'brightYellow' } ;
const tagNameStyle = { color: 'yellow' } ;
const tagAttributeNameStyle = { color: 'green' } ;

const numberStyle = { color: 'cyan' } ;
const entityStyle = { color: 'cyan' } ;
const stringStyle = { color: 'blue' } ;
const escapeStyle = { color: 'brightCyan' , bold: true } ;

const commentStyle = { color: 'gray' } ;
const cdataStyle = { color: 'white' , italic: true } ;
const propertyStyle = { color: 'green' } ;

const parseErrorStyle = { color: 'brightWhite' , bgColor: 'red' , bold: true } ;



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
					match: '<' ,
					state: 'maybeTag'
				} ,
				{
					match: ']' ,
					matchMicroState: 'nestedDefinitionTag' ,
					state: 'closeNestedDefinitionTag'
				} ,
				{
					match: '&' ,
					state: 'entity'
				}
			]
		} ,
		entity: {
			action: [ 'style' , entityStyle ] ,
			branches: [
				{
					match: /[#a-z0-9]/ ,
					state: 'entityName'
				} ,
				{
					match: true ,
					action: [ 'streakStyle' , parseErrorStyle ] ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		entityName: {
			action: [ 'style' , entityStyle ] ,
			branches: [
				{
					match: /[a-z0-9]/ ,
					state: 'entityName'
				} ,
				{
					match: ';' ,
					state: 'idle' ,
					delay: true
				} ,
				{
					match: true ,
					action: [ 'streakStyle' , parseErrorStyle ] ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,



		maybeTag: {
			action: [ 'style' , tagStyle ] ,
			startSpan: 'tag' ,
			branches: [
				{
					match: '/' ,
					state: 'closeTag'
				} ,
				{
					// Declaration: <? ... ?>
					match: '?' ,
					action: [ 'spanStyle' , 'tag' , declarationTagStyle ] ,
					state: 'declarationTag'
				} ,
				{
					// Could be a comments <!-- ... -->
					// Could be a <!DOCTYPE html> or <!ENTITY ... >
					// Could be a <![CDATA[ ... ]]>
					match: '!' ,
					state: 'maybeComment'
				} ,
				{
					match: true ,
					state: 'openTag' ,
					propagate: true
				}
			]
		} ,
		openTag: {
			action: [ 'style' , tagStyle ] ,
			microState: { openTag: false } ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: true ,
					state: 'openTagName' ,
					propagate: true
				}
			]
		} ,
		openTagName: {
			action: [ 'style' , tagNameStyle ] ,
			span: 'tagName' ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: /[a-zA-Z0-9:_-]/ ,
					state: 'openTagName'
				} ,
				{
					match: true ,
					state: 'afterOpenTagName' ,
					microState: { openTag: [ 'span' , 'tagName' ] } ,
					propagate: true
				}
			]
		} ,
		afterOpenTagName: {
			action: [ 'style' , tagNameStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: '>' ,
					state: 'endOpenTag'
				} ,
				{
					match: '/' ,
					state: 'maybeSelfClosingTag'
				} ,
				{
					match: /[ \t\n]/ ,
					state: 'openTagAttributesPart'
				} ,
				{
					match: true ,
					state: 'openTagError'
				}
			]
		} ,
		maybeSelfClosingTag: {
			action: [ 'style' , tagStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: '>' ,
					state: 'endSelfClosingTag'
				} ,
				{
					match: true ,
					state: 'openTagAttributesPart' ,
					propagate: true
				}
			]
		} ,
		endSelfClosingTag: {
			action: [ 'style' , tagStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		endOpenTag: {
			action: [ 'style' , tagStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: true ,
					subState: 'openTagContent' ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		openTagContent: {
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		openTagAttributesPart: {
			action: [ 'style' , tagStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: /[a-zA-Z0-9:_-]/ ,
					state: 'openTagAttributeName' ,
					propagate: true
				} ,
				{
					match: '>' ,
					state: 'endOpenTag'
				} ,
				{
					match: '/' ,
					state: 'maybeSelfClosingTag'
				}
			]
		} ,
		openTagAttributeName: {
			action: [ 'style' , tagAttributeNameStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: /[a-zA-Z0-9:_-]/ ,
					state: 'openTagAttributeName'
				} ,
				{
					match: '>' ,
					state: 'endOpenTag'
				} ,
				{
					match: '/' ,
					state: 'maybeSelfClosingTag'
				} ,
				{
					match: '=' ,
					state: 'openTagAttributeEqual'
				}
			]
		} ,
		openTagAttributeEqual: {
			action: [ 'style' , operatorStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: true ,
					state: 'openTagAttributeValue' ,
					propagate: true
				}
			]
		} ,
		openTagAttributeValue: {
			action: [ 'style' , stringStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: '"' ,
					subState: 'doubleQuoteAttributeValue' ,
					state: 'openTagAttributesPart'
				} ,
				{
					match: '>' ,
					state: 'endOpenTag'
				} ,
				{
					match: '/' ,
					state: 'maybeSelfClosingTag'
				}
			]
		} ,
		openTagError: {
			action: [ 'spanStyle' , 'tag' , parseErrorStyle ] ,
			span: 'tag' ,
			branches: [
				{
					match: '>' ,
					state: 'endOpenTag' ,
					delay: true
				}
			]
		} ,





		closeTag: {
			action: [ 'style' , tagStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: true ,
					state: 'closeTagName' ,
					propagate: true
				}
			]
		} ,
		closeTagName: {
			action: [ 'style' , tagNameStyle ] ,
			span: 'tagName' ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: /[a-zA-Z0-9:_-]/ ,
					state: 'closeTagName'
				} ,
				{
					match: true ,
					state: 'afterCloseTagName' ,
					microState: { closeTag: [ 'span' , 'tagName' ] } ,
					propagate: true
				}
			]
		} ,
		afterCloseTagName: {
			action: [ 'style' , tagNameStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: /[a-zA-Z0-9_-]/ ,
					state: 'closeTagName'
				} ,
				{
					match: '>' ,
					state: 'endCloseTag'
				} ,
				{
					match: true ,
					state: 'closeTagError'
				}
			]
		} ,
		endCloseTag: {
			expandSpan: 'tag' ,
			action: [ 'style' , tagStyle ] ,
			return: {
				// if not returning from 'endOpenTag', we've got a parseError
				matchState: 'openTagContent' ,
				matchMicroState: { openTag: [ 'microState' , 'closeTag' ] } ,
				errorAction: [ [ 'spanStyle' , 'tag' , parseErrorStyle ] , [ 'returnSpanStyle' , 'tag' , parseErrorStyle ] ] ,
			} ,
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeTagError: {
			action: [ 'style' , parseErrorStyle ] ,
			branches: [
				{
					match: '>' ,
					state: 'endCloseTag'
				}
			]
		} ,





		maybeComment: {
			action: [ 'style' , tagStyle ] ,
			span: 'tag' ,
			branches: [
				{
					// Could be a comments <!-- ... -->
					match: '-' ,
					state: 'maybeComment2'
				} ,
				{
					// Could be a <![CDATA[ ... ]]>
					match: '[' ,
					state: 'maybeCDATA'
				} ,
				{
					// Could be a <!DOCTYPE html>, <!ENTITY ... >, <!ATTLIST ... >,  <!ELEMENT ... >, etc...
					match: /[a-zA-Z0-9_-]/ ,
					action: [ 'spanStyle' , 'tag' , definitionTagStyle ] ,
					state: 'definitionTagName' ,
					propagate: true
				} ,
				{
					match: true ,
					state: 'openTagError' ,
					propagate: true
				}
			]
		} ,
		maybeComment2: {
			action: [ 'style' , tagStyle ] ,
			span: 'tag' ,
			branches: [
				{
					match: '-' ,
					action: [ 'spanStyle' , 'tag' , commentStyle ] ,
					state: 'comment' ,
				} ,
				{
					match: true ,
					state: 'openTagError' ,
					propagate: true
				}
			]
		} ,
		comment: {
			action: [ 'style' , commentStyle ] ,
			span: 'tag' ,
			branches: [
				{
					match: '-' ,
					state: 'maybeEndComment'
				}
			]
		} ,
		maybeEndComment: {
			action: [ 'style' , commentStyle ] ,
			span: 'tag' ,
			branches: [
				{
					match: '-' ,
					state: 'maybeEndComment2'
				} ,
				{
					match: true ,
					state: 'comment' ,
					propagate: true
				}
			]
		} ,
		maybeEndComment2: {
			action: [ 'style' , commentStyle ] ,
			span: 'tag' ,
			branches: [
				{
					match: '>' ,
					state: 'endComment'
				} ,
				{
					match: '-' ,
					state: 'maybeEndComment2'
				} ,
				{
					match: true ,
					state: 'comment' ,
					propagate: true
				}
			]
		} ,
		endComment: {
			action: [ 'style' , commentStyle ] ,
			span: 'tag' ,
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,





		maybeCDATA: {
			action: [ 'style' , tagStyle ] ,
			span: [ 'tag' , 'CDATAMark' ] ,
			branches: [
				{
					match: /[CDAT[]/ ,
					state: 'maybeCDATA' ,
				} ,
				{
					match: true ,
					state: 'openTagError' ,
					propagate: true ,
					
					branchOn: 'CDATAMark' ,
					spanBranches: [
						{
							match: '[CDATA[' ,
							state: 'CDATA'
						} ,
						{
							match: true ,
							state: 'openTagError' ,
							propagate: true
						}
					]
				}
			]
		} ,
		CDATA: {
			action: [ 'style' , cdataStyle ] ,
			branches: [
				{
					match: ']' ,
					state: 'maybeEndCDATA'
				}
			]
		} ,
		maybeEndCDATA: {
			action: [ 'style' , cdataStyle ] ,
			span: 'closeCDATA' ,
			branches: [
				{
					match: ']' ,
					state: 'maybeEndCDATA2'
				} ,
				{
					match: true ,
					state: 'CDATA' ,
					propagate: true
				}
			]
		} ,
		maybeEndCDATA2: {
			action: [ 'style' , cdataStyle ] ,
			span: [ 'closeCDATA' , 'closeCDATA2' ] ,
			branches: [
				{
					match: '>' ,
					state: 'endCDATA'
				} ,
				{
					match: ']' ,
					state: 'maybeEndCDATA2' ,
					copySpan: [ 'closeCDATA2' , 'closeCDATA' ]
				} ,
				{
					match: true ,
					state: 'CDATA' ,
					propagate: true
				}
			]
		} ,
		endCDATA: {
			action: [ 'spanStyle' , 'closeCDATA' , tagStyle ] ,
			span: 'closeCDATA' ,
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,





		declarationTag: {
			action: [ 'style' , declarationTagStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: true ,
					state: 'declarationTagName' ,
					propagate: true
				}
			]
		} ,
		maybeEndDeclarationTag: {
			action: [ 'style' , declarationTagStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: '>' ,
					state: 'endDeclarationTag' ,
				} ,
				{
					match: true ,
					state: 'declarationTagAttributesPart' ,
					propagate: true
				}
			]
		} ,
		endDeclarationTag: {
			action: [ 'style' , declarationTagStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		declarationTagName: {
			action: [ 'style' , declarationTagNameStyle ] ,
			span: 'tagName' ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: /[a-zA-Z0-9:_-]/ ,
					state: 'declarationTagName'
				} ,
				{
					match: true ,
					state: 'afterDeclarationTagName' ,
					propagate: true
				}
			]
		} ,
		afterDeclarationTagName: {
			action: [ 'style' , declarationTagNameStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: '?' ,
					state: 'maybeEndDeclarationTag'
				} ,
				{
					match: /[ \t\n]/ ,
					state: 'declarationTagAttributesPart'
				} ,
				{
					match: true ,
					state: 'declarationTagError'
				}
			]
		} ,
		declarationTagAttributesPart: {
			action: [ 'style' , declarationTagNameStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: /[a-zA-Z0-9:_-]/ ,
					state: 'declarationTagAttributeName' ,
					propagate: true
				} ,
				{
					match: '?' ,
					state: 'maybeEndDeclarationTag'
				}
			]
		} ,
		declarationTagAttributeName: {
			action: [ 'style' , declarationTagAttributeNameStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: /[a-zA-Z0-9:_-]/ ,
					state: 'declarationTagAttributeName'
				} ,
				{
					match: '?' ,
					state: 'maybeEndDeclarationTag'
				} ,
				{
					match: '=' ,
					state: 'declarationTagAttributeEqual'
				}
			]
		} ,
		declarationTagAttributeEqual: {
			action: [ 'style' , operatorStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: true ,
					state: 'declarationTagAttributeValue' ,
					propagate: true
				}
			]
		} ,
		declarationTagAttributeValue: {
			action: [ 'style' , stringStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: '"' ,
					subState: 'doubleQuoteAttributeValue' ,
					state: 'declarationTagAttributesPart'
				} ,
				{
					match: '?' ,
					state: 'maybeEndDeclarationTag'
				}
			]
		} ,
		declarationTagError: {
			action: [ 'style' , parseErrorStyle ] ,
			branches: [
				{
					match: '?' ,
					state: 'maybeEndDeclarationTag'
				}
			]
		} ,




		// Definition: <! ... >
		// Can be nested: <!DOCTYPE mydoctype [ <!ELEMENT ... > ]>
		definitionTag: {
			action: [ 'style' , definitionTagStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: true ,
					state: 'definitionTagName' ,
					propagate: true
				}
			]
		} ,
		endDefinitionTag: {
			action: [ 'style' , definitionTagStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: true ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		definitionTagName: {
			action: [ 'style' , definitionTagNameStyle ] ,
			span: 'tagName' ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: /[a-zA-Z0-9:_-]/ ,
					state: 'definitionTagName'
				} ,
				{
					match: true ,
					state: 'afterDefinitionTagName' ,
					propagate: true
				}
			]
		} ,
		afterDefinitionTagName: {
			action: [ 'style' , definitionTagNameStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: '>' ,
					state: 'endDefinitionTag'
				} ,
				{
					match: /[ \t\n]/ ,
					state: 'definitionTagAttributesPart'
				} ,
				{
					match: '[' ,
					subState: 'openNestedDefinitionTag'
				} ,
				{
					match: true ,
					state: 'definitionTagError'
				}
			]
		} ,
		definitionTagAttributesPart: {
			action: [ 'style' , definitionTagNameStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: /[a-zA-Z0-9:_-]/ ,
					state: 'definitionTagAttributeName' ,
					propagate: true
				} ,
				{
					match: '[' ,
					subState: 'openNestedDefinitionTag'
				} ,
				{
					match: '>' ,
					state: 'endDefinitionTag'
				}
			]
		} ,
		definitionTagAttributeName: {
			action: [ 'style' , definitionTagAttributeNameStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: /[a-zA-Z0-9:_-]/ ,
					state: 'definitionTagAttributeName'
				} ,
				{
					match: /[ \t\n]/ ,
					state: 'definitionTagAttributesPart'
				} ,
				{
					match: '>' ,
					state: 'endDefinitionTag'
				} ,
				{
					match: '=' ,
					state: 'definitionTagAttributeEqual'
				}
			]
		} ,
		definitionTagAttributeEqual: {
			action: [ 'style' , operatorStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: true ,
					state: 'definitionTagAttributeValue' ,
					propagate: true
				}
			]
		} ,
		definitionTagAttributeValue: {
			action: [ 'style' , stringStyle ] ,
			expandSpan: 'tag' ,
			branches: [
				{
					match: '"' ,
					subState: 'doubleQuoteAttributeValue' ,
					state: 'definitionTagAttributesPart'
				} ,
				{
					match: '>' ,
					state: 'endDefinitionTag'
				}
			]
		} ,
		openNestedDefinitionTag: {
			action: [ 'style' , parseErrorStyle ] ,
			branches: [
				{
					match: true ,
					microState: { nestedDefinitionTag: true } ,
					state: 'idle' ,
					propagate: true
				}
			]
		} ,
		closeNestedDefinitionTag: {
			action: [ [ 'style' , definitionTagBracketStyle ] , [ 'openerStyle' , definitionTagBracketStyle ] ] ,
			return: {
				matchState: 'openNestedDefinitionTag' ,
				errorAction: [ 'style' , parseErrorStyle ]
			} ,
			branches: [
				{
					match: true ,
					state: 'definitionTagError' ,
					propagate: true
				}
			]
		} ,
		definitionTagError: {
			action: [ 'style' , parseErrorStyle ] ,
			branches: [
				{
					match: '>' ,
					state: 'endDefinitionTag'
				}
			]
		} ,






		doubleQuoteAttributeValue: {
			action: [ 'style' , stringStyle ] ,
			branches: [
				{
					match: '\\' ,
					subState: 'escape'
				} ,
				{
					match: '"' ,
					return: true ,
					delay: true
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

