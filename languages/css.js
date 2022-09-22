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

const selectorStyle = { color: 'brightMagenta' , bold: true } ;

const numberStyle = { color: 'cyan' } ;
const entityStyle = { color: 'cyan' } ;
const stringStyle = { color: 'blue' } ;
const escapeStyle = { color: 'brightCyan' , bold: true } ;

const commentStyle = { color: 'gray' } ;
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
					match: /[#.[\]=a-zA-Z0-9:_-]/ ,
					state: 'selector' ,
					propagate: true
				} ,
				{
					match: /[ \t\n]/ ,
					state: 'idle'
				}
			]
		} ,
		selector: {
			action: [ 'style' , selectorStyle ] ,
			branches: [
				{
					match: /[#.[\]=a-zA-Z0-9:_ \t\n-]/ ,
					state: 'selector' ,
				} ,
				{
					match: '{' ,
					state: 'declarationIdle'
				} ,
				{
					match: true ,
					action: [ 'style' , parseErrorStyle ] ,
					state: 'idle'
				}
			]
		} ,



		declarationIdle: {
			action: [ 'style' , idleStyle ] ,
			branches: [
				{
					match: /[a-zA-Z0-9-]/ ,
					state: 'declarationProperty' ,
					propagate: true
				} ,
				{
					match: '}' ,
					state: 'idle'
				} ,
				{
					match: /[ \t\n]/ ,
					state: 'declarationIdle'
				} ,
				{
					match: true ,
					state: 'declarationError'
				}
			]
		} ,
		declarationProperty: {
			action: [ 'style' , propertyStyle ] ,
			branches: [
				{
					match: /[a-zA-Z0-9-]/ ,
					state: 'declarationProperty' ,
				} ,
				{
					match: true ,
					state: 'declarationAfterProperty' ,
					propagate: true
				}
			]
		} ,
		declarationAfterProperty: {
			action: [ 'style' , idleStyle ] ,
			branches: [
				{
					match: /[ \t\n]/ ,
					state: 'declarationAfterProperty' ,
				} ,
				{
					match: ':' ,
					state: 'declarationAfterColon'
				} ,
				{
					match: true ,
					state: 'declarationError'
				}
			]
		} ,
		declarationAfterColon: {
			action: [ 'style' , operatorStyle ] ,
			branches: [
				{
					match: /[ \t\n]/ ,
					state: 'declarationAfterColon' ,
				} ,
				{
					match: true ,
					state: 'declarationValue' ,
					propagate: true
				}
			]
		} ,
		declarationValue: {
			action: [ 'style' , stringStyle ] ,
			branches: [
				{
					match: ';' ,
					state: 'declarationIdle'
				}
			]
		} ,
		declarationError: {
			action: [ 'style' , parseErrorStyle ] ,
			branches: [
				{
					match: '}' ,
					state: 'idle'
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

