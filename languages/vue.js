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



/* Modified from XML parser */



const idleStyle = { color: 'white' } ;
const operatorStyle = { color: 'brightWhite' , bold: true } ;

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

const embeddedStyle = { color: 'brightWhite' , bgColor: 'yellow' , bold: true } ;
const debugStyle = { color: 'brightWhite' , bgColor: 'green' , bold: true } ;

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
					// Could be a comments <!-- ... -->
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
					propagate: true ,
					
					branchOn: 'tagName' ,
					spanBranches: [
						{
							match: 'script' ,
							subState: 'openEmbedded' ,
							state: 'idle' ,
							propagate: true
						}
					]
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





		openEmbedded: {
			branches: [
				{
					match: true ,
					state: 'embedded' ,
					propagate: true
				}
			]
		} ,
		embedded: {
			action: [ 'style' , embeddedStyle ] ,
			branches: [
				{
					match: '<' ,
					state: 'maybeEmbeddedCloseTag'
				}
			]
		} ,
		maybeEmbeddedCloseTag: {
			action: [ 'style' , tagStyle ] ,
			startSpan: 'embeddedTag' ,
			branches: [
				{
					match: '/' ,
					state: 'maybeEmbeddedCloseTag2'
				} ,
				{
					match: true ,
					state: 'embedded' ,
					propagate: true
				}
			]
		} ,
		maybeEmbeddedCloseTag2: {
			action: [ 'style' , tagStyle ] ,
			expandSpan: 'embeddedTag' ,
			branches: [
				{
					match: true ,
					state: 'embeddedCloseTagName' ,
					propagate: true
				}
			]
		} ,
		embeddedCloseTagName: {
			action: [ 'style' , tagNameStyle ] ,
			span: 'embeddedCloseTagName' ,
			expandSpan: 'embeddedTag' ,
			branches: [
				{
					match: /[a-zA-Z0-9:_-]/ ,
					state: 'embeddedCloseTagName'
				} ,
				{
					match: true ,
					state: 'afterEmbeddedCloseTagName' ,
					microState: { closeTag: [ 'span' , 'embeddedCloseTagName' ] } ,
					propagate: true
				}
			]
		} ,
		afterEmbeddedCloseTagName: {
			action: [ 'style' , tagNameStyle ] ,
			expandSpan: 'embeddedTag' ,
			branches: [
				{
					match: /[a-zA-Z0-9_-]/ ,
					state: 'embeddedCloseTagName'
				} ,
				{
					match: '>' ,
					state: 'endEmbeddedCloseTag'
				} ,
				{
					match: true ,
					state: 'embedded'
				}
			]
		} ,
		endEmbeddedCloseTag: {
			expandSpan: 'embeddedTag' ,
			action: [ 'style' , tagStyle ] ,
			return: {
				// if not returning from 'endOpenTag', we've got a parseError
				matchState: 'openEmbedded' ,
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

