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



/*
	Optimization ideas:
		* save states at different point in the buffer
		* when something changes, resume the TextMachine at the closest previous saved state
		* if the state machine pass to a checkpoint where the saved state has not changed, it is stopped
*/

function TextMachine( options ) {
	this.program = options.program ;
	this.api = options.api || {} ;
	this.stateStack = null ;

	this.index = 0 ;
	this.store = {} ;

	// TODO
	//this.savedStateStack = [] ;

	this.sanitize() ;
	this.reset() ;
}

module.exports = TextMachine ;



const MATCH_ALWAYS = 0 ;
const MATCH_STRING = 1 ;
const MATCH_SET = 2 ;
const MATCH_REGEXP = 3 ;
const MATCH_FUNCTION = 4 ;



TextMachine.prototype.sanitize = function() {
	if ( this.program.states && typeof this.program.states === 'object' ) {
		for ( let name in this.program.states ) {
			let stateProgram = this.program.states[ name ] ;

			if ( stateProgram.branches ) {
				for ( let branchProgram of stateProgram.branches ) {
					this.sanitizeBranchProgram( branchProgram ) ;

					if ( branchProgram.spanBranches ) {
						for ( let spanBranchProgram of branchProgram.spanBranches ) {
							this.sanitizeBranchProgram( spanBranchProgram ) ;
						}
					}
				}
			}
		}
	}
} ;



TextMachine.prototype.sanitizeBranchProgram = function( branchProgram ) {
	if ( branchProgram.match === true ) {
		branchProgram.matchType = MATCH_ALWAYS ;
	}
	else if ( typeof branchProgram.match === 'string' ) {
		branchProgram.matchType = MATCH_STRING ;
	}
	else if ( Array.isArray( branchProgram.match ) ) {
		branchProgram.match = new Set( branchProgram.match ) ;
		branchProgram.matchType = MATCH_SET ;
	}
	else if ( branchProgram.match instanceof Set ) {
		branchProgram.matchType = MATCH_SET ;
	}
	else if ( branchProgram.match instanceof RegExp ) {
		branchProgram.matchType = MATCH_REGEXP ;
	}
	else if ( typeof branchProgram.match === 'function' ) {
		branchProgram.matchType = MATCH_FUNCTION ;
	}
} ;



TextMachine.prototype.reset = function() {
	this.index = 0 ;
	this.store = {} ;

	this.stateStack = [ {
		name: this.program.config.initState || 'init' ,
		parent: null ,
		microState: {} ,
		span: {}
	} ] ;
} ;



TextMachine.prototype.pushEvent = function( event , context ) {
	var initialState , state ,
		initialStateProgram , stateProgram , branchProgram ,
		isDelayed = false ,
		stateHasSwitched = false ;

	//console.error( "\n>>> PUSH: '" + event + "'" ) ;
	// Get the current state
	initialState = state = this.stateStack[ this.stateStack.length - 1 ] ;

	// Active state program
	initialStateProgram = stateProgram = this.program.states[ state.name ] ;

	do {

		// First we select the branch and apply its feats

		branchProgram = this.branchMatch( stateProgram.branches , event , state ) ;

		if ( branchProgram ) {
			if ( branchProgram.spanBranches && branchProgram.branchOn && state.span[ branchProgram.branchOn ] ) {
				// Try to match a span branch
				//console.error( ">>> '" + state.span[ branchProgram.branchOn ].content + "'" ) ;
				branchProgram = this.branchMatch( branchProgram.spanBranches , state.span[ branchProgram.branchOn ].content , state )
					|| branchProgram ;
			}

			if ( branchProgram.microState ) {
				this.setMicroState( branchProgram.microState , state ) ;
			}

			if ( branchProgram.delay ) { isDelayed = true ; }

			if ( branchProgram.store ) {
				let key = branchProgram.store[ 0 ] ,
					value = this.getDynamicValue( branchProgram.store[ 1 ] , state ) ;
				
				if ( value ) {
					if ( ! this.store[ key ] ) { this.store[ key ] = new Set() ; }
					this.store[ key ].add( value ) ;
				}
			}

			// Exec the branch action on the current state now, if any...
			if ( branchProgram.return && this.useReturnErrorAction( branchProgram.return , state ) ) {
				// This is a return error (mostly parenthesis/brace/bracket parse errors)
				//console.error( ">>> APPLY branch returnErrorAction" ) ;
				this.execActions( branchProgram.return.errorAction , state , context ) ;
			}
			else if ( branchProgram.action ) {
				this.execActions( branchProgram.action , state , context ) ;
			}
		}


		// Now it depends on which branching mode occured

		if ( this.stateStack.length > 1 && ( stateProgram.return || branchProgram?.return ) ) {
			// Returning from sub-state (recursion)
			console.error( "RETURN" , state.name , '-->' , state.openingState , '(wanted: ' + ( stateProgram.return || branchProgram?.return ) + ')' , '-->-->' , state.parent?.returnState ) ;

			stateHasSwitched = true ;
			this.stateStack.length -- ;

			state = this.stateStack[ this.stateStack.length - 1 ] ;
			stateProgram = this.program.states[ state.name ] ;

			if ( state.returnState ) {
				// Overwrite the old state with the new one
				stateProgram = this.program.states[ state.returnState ] ;
				if ( ! stateProgram ) { throw new Error( "State not found: " + state.returnState + " from " + state.name ) ; }

				state = this.stateStack[ this.stateStack.length - 1 ] = {
					name: state.returnState ,
					parent: state.parent ,
					context: context ,
					previousName: state.name ,
					previousContext: state.context ,
					microState: state.microState ,
					span: state.span ,
					openingContext: state.openingContext ,
					openingState: state.openingState ,
					startingStateContext: context
				} ;
			}
		}
		else if ( ! branchProgram || (
			( ! branchProgram.state || branchProgram.state === state.name )
			&& ! branchProgram.subState
			&& ( ! branchProgram.return || this.stateStack.length <= 1 )
		) ) {
			// Continue / No state change
			//console.error( "CONTINUE" , state.name ) ;

			state.previousName = state.name ;
			state.previousContext = state.context ;
			state.context = context ;
		}
		else if ( branchProgram.subState ) {
			// Entering sub-state (recursion)
			console.error( "ENTERING SUB STATE" , state.name , '-->' , branchProgram.subState ) ;

			stateHasSwitched = true ;
			stateProgram = this.program.states[ branchProgram.subState ] ;
			if ( ! stateProgram ) { throw new Error( "State not found: " + branchProgram.subState + " from " + state.name ) ; }

			// Save the opening context
			state.returnState = branchProgram.state ;

			// Create a new state and push it at the end of the stack
			state = this.stateStack[ this.stateStack.length ] = {
				name: branchProgram.subState ,
				parent: state ,
				context: context ,
				microState: {} ,
				span: {} ,
				openingContext: context ,
				openingState: branchProgram.subState ,
				startingStateContext: context
			} ;
		}
		else {
			// Switch to state
			//console.error( "SWITCH" , state.name , '-->' , branchProgram.state ) ;

			stateHasSwitched = true ;

			// Now change the state
			stateProgram = this.program.states[ branchProgram.state ] ;
			if ( ! stateProgram ) { throw new Error( "State not found: " + branchProgram.state + " from " + state.name ) ; }

			state = this.stateStack[ this.stateStack.length - 1 ] = {
				name: branchProgram.state ,
				parent: state.parent ,
				context: context ,
				previousName: state.name ,
				previousContext: state.context ,
				microState: state.microState ,
				span: state.span ,
				openingContext: state.openingContext ,
				openingState: state.openingState ,
				startingStateContext: context
			} ;
		}


		// Finally apply state feats

		if ( stateProgram.span ) { this.manageSpans( stateProgram.span , event , context , state ) ; }
		if ( stateProgram.startSpan ) { this.manageSpans( stateProgram.startSpan , event , context , state , true ) ; }
		if ( stateProgram.expandSpan ) { this.manageSpans( stateProgram.expandSpan , event , context , state , false , true ) ; }

		if ( stateProgram.microState ) { this.setMicroState( stateProgram.microState , state ) ; }


		// Exec the action for the state, if any...
		if ( isDelayed ) {
			if ( initialStateProgram.action ) {
				this.execActions( initialStateProgram.action , initialState , context ) ;
			}
		}
		else if ( stateProgram.return && this.useReturnErrorAction( stateProgram.return , state ) ) {
			// This is a return error (mostly parenthesis/brace/bracket parse errors)
			//console.error( ">>> APPLY state returnErrorAction" , this.stateStack.length , stateProgram.return , state.openingState ) ;
			this.execActions( stateProgram.return.errorAction , state , context ) ;
		}
		else if ( stateProgram.action ) {
			this.execActions( stateProgram.action , state , context ) ;
		}

	// Propagate the event to the next state now?
	} while ( stateHasSwitched && branchProgram?.propagate ) ;

	this.index ++ ;
} ;



TextMachine.prototype.useReturnErrorAction = function( returnProgram , state ) {
	return (
		typeof returnProgram === 'object' && returnProgram.errorAction
		&& (
			this.stateStack.length <= 1
			|| ( returnProgram.matchState && returnProgram.matchState !== state.openingState )
			|| ( returnProgram.matchMicroState && ! this.isMicroStateEqual( returnProgram.matchMicroState , state , state.parent ) )
		)
	) ;
} ;



// Get the first matching branchProgram
TextMachine.prototype.branchMatch = function( branches , str , state ) {
	if ( ! Array.isArray( branches ) ) { return ; }

	for ( let branchProgram of branches ) {
		let isMatching =
			branchProgram.matchType === MATCH_ALWAYS ? true :
			branchProgram.matchType === MATCH_STRING ? branchProgram.match === str :
			branchProgram.matchType === MATCH_SET ? branchProgram.match.has( str ) :
			branchProgram.matchType === MATCH_REGEXP ? branchProgram.match.test( str ) :
			branchProgram.matchType === MATCH_FUNCTION ? !! branchProgram.match( str ) :
			false ;

		if ( isMatching === ! branchProgram.inverse ) {
			if ( ! branchProgram.matchMicroState || this.isMicroStateEqual( branchProgram.matchMicroState , state ) ) {
				return branchProgram ;
			}
		}
	}
} ;



TextMachine.prototype.manageSpans = function( spanProgram , event , context , state , isStart = false , isExpand = false ) {
	if ( Array.isArray( spanProgram ) ) {
		spanProgram.forEach( element => this.manageSpan( element , event , context , state , isStart , isExpand ) ) ;
	}
	else {
		this.manageSpan( spanProgram , event , context , state , isStart , isExpand ) ;
	}
} ;



TextMachine.prototype.manageSpan = function( spanProgram , event , context , state , isStart = false , isExpand = false ) {
	console.error( "Spans:" , Object.entries( state.span ).map( e => [ e[ 0 ] , e[ 1 ].content ] ) ) ;
	let existingSpan = state.span[ spanProgram ] ;

	if ( isStart || ! existingSpan || ( existingSpan.end !== this.index - 1 && ! isExpand ) ) {
		// Already started here? no need to create a new object (propagate case)
		if ( existingSpan && existingSpan.start === this.index ) { return ; }

		// Start a new span
		existingSpan = state.span[ spanProgram ] = {
			startingContext: context ,
			endingContext: context ,
			start: this.index ,
			end: this.index ,
			// existingSpan.content is unused ATM, except for debugging purpose, but could be useful in the future
			content: event
		} ;

		console.error( "Start new span:" , spanProgram , existingSpan.content ) ;
		return ;
	}

	// Watch out! In case of propagate, the span could have been already expanded to the current index, in that case there is nothing to do
	if ( existingSpan && existingSpan.end === this.index ) { return ; }

	// Start continue an existing span
	existingSpan.end = this.index ;
	existingSpan.endingContext = context ;

	// existingSpan.content is unused ATM, except for debugging purpose, but could be useful in the future
	existingSpan.content += event ;
	console.error( "Continue span:" , spanProgram , existingSpan.content ) ;
} ;



TextMachine.prototype.setMicroState = function( microStateProgram , state ) {
	for ( let name in microStateProgram ) {
		let value = microStateProgram[ name ] ;

		if ( typeof value === 'string' || typeof value === 'number' ) { state.microState[ name ] = value ; }
		else if ( ! value ) { delete state.microState[ name ] ; }
		else if ( Array.isArray( value ) ) { state.microState[ name ] = this.getDynamicValue( value , state ) ; }
		else { state.microState[ name ] = true ; }
	}
} ;



TextMachine.prototype.isMicroStateEqual = function( microStateProgram , contextState , toState = contextState ) {
	//console.error( ".isMicroStateEqual()" , microStateProgram , toState.microState ) ;
	if ( microStateProgram && typeof microStateProgram === 'object' ) {
		if ( Array.isArray( microStateProgram ) ) {
			return microStateProgram.every( name => toState.microState[ name ] ) ;
		}
		else {
			for ( let name in microStateProgram ) {
				// First, coerce or substitute
				let value = microStateProgram[ name ] ;
				value =
					value === false || value === null || value === undefined ? undefined :
					Array.isArray( value ) ? this.getDynamicValue( value , contextState ) :
					value ;

				//if ( microStateProgram[ name ] !== value ) { console.error( "Value coerced or substituted:" , name , microStateProgram[ name ] , value ) ; }
				if ( value !== toState.microState[ name ] ) {
					return false ;
				}
			}

			return true ;
		}
	}
	else {
		return !! toState.microState[ microStateProgram ] ;
	}
} ;



TextMachine.prototype.getDynamicValue = function( path , state ) {
	if ( path[ 0 ] === 'microState' ) { return state.microState[ path[ 1 ] ] ; }
	if ( path[ 0 ] === 'span' ) { return state.span[ path[ 1 ] ]?.content ; }
} ;



TextMachine.prototype.execActions = function( actions , state , context ) {
	if ( ! actions || ! actions.length ) { return ; }

	if ( ! Array.isArray( actions[ 0 ] ) ) {
		return this.execAction( actions , state , context ) ;
	}

	for ( let action of actions ) {
		this.execAction( action , state , context ) ;
	}
} ;



TextMachine.prototype.execAction = function( action , state , context ) {
	var actionName = action[ 0 ] ;
	//console.error( "ACTION:" , actionName ) ;

	switch ( actionName ) {
		case 'style' :
			this.api.style( context , action[ 1 ] ) ;
			break ;
		case 'starterStyle' :
			//console.error( "  -> " , state.startingStateContext.x , state.startingStateContext.y ) ;
			this.api.style( state.startingStateContext , action[ 1 ] ) ;
			break ;
		case 'openerStyle' :
			//console.error( "  -> " , state.openingContext.x , state.openingContext.y ) ;
			this.api.style( state.openingContext , action[ 1 ] ) ;
			break ;
		case 'streakStyle' :
			this.api.blockStyle( state.startingStateContext , context , action[ 1 ] ) ;
			break ;
		case 'spanStyle' : {
			let span = state.span[ action[ 1 ] ] ;
			//console.error( "  -> " , span ) ;
			if ( ! span ) { break ; }
			this.api.blockStyle( span.startingContext , span.endingContext , action[ 2 ] ) ;
			break ;
		}
		case 'returnSpanStyle' : {
			if ( ! state.parent ) { break ; }
			let span = state.parent.span[ action[ 1 ] ] ;
			//console.error( "  -> " , span ) ;
			if ( ! span ) { break ; }
			this.api.blockStyle( span.startingContext , span.endingContext , action[ 2 ] ) ;
			break ;
		}
		case 'hint' :
			// /!\ Should be refactored...
			let span = state.span[ action[ 1 ] ] ;
			//console.error( "  -> " , span ) ;
			if ( ! span ) { break ; }
			this.api.hint( context , span.content , action[ 2 ] ) ;
			break ;
	}
} ;

