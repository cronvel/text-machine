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

const tagStyle = { color: 'brightYellow' } ;
const tagNameStyle = { color: 'yellow' } ;
const attributeNameStyle = { color: 'green' } ;

const numberStyle = { color: 'cyan' } ;
const entityStyle = { color: 'cyan' } ;
const stringStyle = { color: 'blue' } ;
const escapeStyle = { color: 'brightCyan' , bold: true } ;

const commentStyle = { color: 'brightBlack' } ;
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
			branches: [
				{
					match: '/' ,
					state: 'closeTag'
				} ,
				{
					// Definition: <? ... ?>
					match: '?' ,
					state: 'maybeDeclaration'
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
			branches: [
				{
					match: '>' ,
					state: 'endOpenTag'
				} ,
				{
					match: true ,
					state: 'openTagName' ,
					propagate: true
				}
			]
		} ,
		endOpenTag: {
			action: [ 'style' , tagStyle ] ,
			branches: [
				{
					match: true ,
					subState: 'openTagContent' ,
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
		openTagName: {
			action: [ 'style' , tagNameStyle ] ,
			buffer: true ,
			branches: [
				{
					match: /[a-zA-Z0-9_-]/ ,
					state: 'openTagName'
				} ,
				{
					match: true ,
					state: 'afterOpenTagName' ,
					microState: { openTag: [ 'buffer' ] } ,
					propagate: true
				}
			]
		} ,
		afterOpenTagName: {
			action: [ 'style' , tagNameStyle ] ,
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
					state: 'attributesPart'
				} ,
				{
					match: true ,
					state: 'openTagError'
				}
			]
		} ,
		maybeSelfClosingTag: {
			action: [ 'style' , tagStyle ] ,
			branches: [
				{
					match: '>' ,
					state: 'endOpenTag'
				} ,
				{
					match: true ,
					state: 'attributesPart' ,
					propagate: true
				}
			]
		} ,
		attributesPart: {
			action: [ 'style' , tagStyle ] ,
			branches: [
				{
					match: /[a-zA-Z0-9_:-]/ ,
					state: 'attributeName' ,
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
		attributeName: {
			action: [ 'style' , attributeNameStyle ] ,
			branches: [
				{
					match: /[a-zA-Z0-9_:-]/ ,
					state: 'attributeName'
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
					state: 'attributeEqual'
				}
			]
		} ,
		attributeEqual: {
			action: [ 'style' , operatorStyle ] ,
			branches: [
				{
					match: true ,
					state: 'attributeValue' ,
					propagate: true
				}
			]
		} ,
		attributeValue: {
			action: [ 'style' , stringStyle ] ,
			branches: [
				{
					match: '"' ,
					state: 'doubleQuoteAttributeValue'
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
			action: [ 'style' , parseErrorStyle ] ,
			branches: [
				{
					match: '>' ,
					state: 'endOpenTag'
				}
			]
		} ,





		closeTag: {
			action: [ 'style' , tagStyle ] ,
			branches: [
				{
					match: '>' ,
					state: 'endCloseTag'
				} ,
				{
					match: true ,
					state: 'closeTagName' ,
					propagate: true
				}
			]
		} ,
		closeTagName: {
			action: [ 'style' , tagNameStyle ] ,
			buffer: true ,
			branches: [
				{
					match: /[a-zA-Z0-9_-]/ ,
					state: 'closeTagName'
				} ,
				{
					match: true ,
					state: 'afterCloseTagName' ,
					microState: { closeTag: [ 'buffer' ] } ,
					propagate: true
				}
			]
		} ,
		afterCloseTagName: {
			action: [ 'style' , tagNameStyle ] ,
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
			returnAfter: 'openTagContent' ,
			returnToMicroState: { openTag: [ 'microState' , 'closeTag' ] } ,
			action: [ 'style' , tagStyle ] ,
			//action: [ [ 'style' , tagStyle ] , [ 'openerStyle' , openTagStyle ] ] ,
            returnErrorAction: [ 'style' , parseErrorStyle ] ,  // if not returning from 'endOpenTag', we've got a parseError
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





		doubleQuoteAttributeValue: {
			action: [ 'style' , stringStyle ] ,
			branches: [
				{
					match: '\\' ,
					subState: 'escape'
				} ,
				{
					match: '"' ,
					state: 'attributesPart' ,
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

