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
				for ( let branchProgram of stateProgram.branches ) { this.sanitizeBranchProgram( branchProgram ) ; }
			}

			if ( stateProgram.bufferBranches ) {
				for ( let branchProgram of stateProgram.bufferBranches ) { this.sanitizeBranchProgram( branchProgram ) ; }
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

	this.stateStack = [ {
		name: this.program.config.initState || 'init' ,
		parent: null ,
		span: {}
	} ] ;
} ;



TextMachine.prototype.pushEvent = function( event , context ) {
	var initialState , state ,
		initialStateProgram , stateProgram , branchProgram , bufferBranchProgram ,
		//delayedAction , buffer ,
		isDelayed = false ,
		stateHasSwitched = false ;

	console.error( "\n>>> PUSH: '" + event + "'" ) ;
	// Get the current state
	initialState = state = this.stateStack[ this.stateStack.length - 1 ] ;

	// Active state program
	initialStateProgram = stateProgram = this.program.states[ state.name ] ;

	do {

		// First we select the branch and apply its feats

		branchProgram = this.branchMatch( stateProgram.branches , event ) ;

		if ( branchProgram ) {
			// Buffer branches are only matched on state-changes
			if ( branchProgram.state && branchProgram.state !== state.name ) {
				bufferBranchProgram = this.branchMatch( stateProgram.bufferBranches , state.buffer ) ;

				// /!\ It seems odd to extend this... /!\
				// Maybe it's more appropriate to just replace it
				if ( bufferBranchProgram ) {
					branchProgram = Object.assign( {} , branchProgram , bufferBranchProgram ) ;
				}
			}

			if ( branchProgram.delay ) { isDelayed = true ; }

			// Exec the branch action on the current state now, if any...
			if ( branchProgram.return && branchProgram.returnErrorAction && (
				this.stateStack.length <= 1
				|| ( typeof branchProgram.return === 'string' && branchProgram.return !== state.openingState )
			) ) {
				// This is a return error (mostly parenthesis/brace/bracket parse errors)
				console.error( ">>> APPLY branch returnErrorAction" ) ;
				this.execActions( branchProgram.returnErrorAction , state , context ) ;
			}
			else if ( branchProgram.action ) {
				this.execActions( branchProgram.action , state , context ) ;
			}
		}


		// Now it depends on which branching mode occured

		if ( this.stateStack.length > 1 && ( stateProgram.returnAfter || branchProgram?.return ) ) {
			// Returning from sub-state (recursion)
			console.error( "RETURN" , state.name , '-->' , state.openingState , '(wanted: ' + ( stateProgram.returnAfter || branchProgram?.return ) + ')' , '-->-->' , state.parent?.returnState ) ;

			stateHasSwitched = true ;
			this.stateStack.length -- ;

			state = this.stateStack[ this.stateStack.length - 1 ] ;
			stateProgram = this.program.states[ state.name ] ;

			if ( state.returnState ) {
				// Overwrite the old state with the new one
				stateProgram = this.program.states[ state.returnState ] ;
				state = this.stateStack[ this.stateStack.length - 1 ] = {
					name: state.returnState ,
					parent: state.parent ,
					context: context ,
					previousName: state.name ,
					previousContext: state.context ,
					span: state.span ,
					openingContext: state.openingContext ,
					openingState: state.openingState ,
					startingStateContext: context ,
					startingSpanContext:
						stateProgram.clearSpan ? null :
						stateProgram.startSpan ? context :
						state.startingSpanContext ,
					endingSpanContext:
						stateProgram.clearSpan ? null :
						stateProgram.endSpan ? context :
						state.endingSpanContext ,
					buffer:
						! stateProgram.bufferBranches ? null :
						branchProgram.preserveBuffer ? state.buffer + event :
						event
				} ;
			}
		}
		else if ( ! branchProgram || (
			( ! branchProgram.state || branchProgram.state === state.name )
			&& ! branchProgram.subState
			&& ( ! branchProgram.return || this.stateStack.length <= 1 )
		) ) {
			// Continue / No state change
			console.error( "CONTINUE" , state.name ) ;

			state.previousName = state.name ;
			state.previousContext = state.context ;
			state.context = context ;

			if ( stateProgram.bufferBranches ) {
				state.buffer += event ;
			}
		}
		else if ( branchProgram.subState ) {
			// Entering sub-state (recursion)
			console.error( "ENTERING SUB STATE" , state.name , '-->' , branchProgram.subState ) ;

			stateHasSwitched = true ;
			stateProgram = this.program.states[ branchProgram.subState ] ;

			// Save the opening context
			state.returnState = branchProgram.state ;

			// Create a new state and push it at the end of the stack
			state = this.stateStack[ this.stateStack.length ] = {
				name: branchProgram.subState ,
				parent: state ,
				context: context ,
				span: {} ,
				openingContext: context ,
				openingState: branchProgram.subState ,
				startingStateContext: context
			} ;
		}
		else {
			// Switch to state
			console.error( "SWITCH" , state.name , '-->' , branchProgram.state ) ;

			stateHasSwitched = true ;

			// Now change the state
			stateProgram = this.program.states[ branchProgram.state ] ;
			state = this.stateStack[ this.stateStack.length - 1 ] = {
				name: branchProgram.state ,
				parent: state.parent ,
				context: context ,
				previousName: state.name ,
				previousContext: state.context ,
				span: state.span ,
				openingContext: state.openingContext ,
				openingState: state.openingState ,
				startingStateContext: context ,
				startingSpanContext:
					stateProgram.clearSpan ? null :
					stateProgram.startSpan ? context :
					state.startingSpanContext ,
				endingSpanContext:
					stateProgram.clearSpan ? null :
					stateProgram.endSpan ? context :
					state.endingSpanContext ,
				buffer:
					! stateProgram.bufferBranches ? null :
					branchProgram.preserveBuffer ? state.buffer + event :
					event
			} ;
		}


		// Finally apply state feats

		if ( stateProgram.span ) {
			let span = state.span[ stateProgram.span ] ;

			if ( span && span.end === this.index - 1 ) {
				span.end = this.index ;
				span.endingContext = context ;
			}
			else {
				span = state.span[ stateProgram.span ] = {
					startingContext: context ,
					endingContext: context ,
					start: this.index ,
					end: this.index
				} ;
			}
		}

		// Exec the action for the state, if any...
		if ( isDelayed ) {
			if ( initialStateProgram.action ) {
				this.execActions( initialStateProgram.action , initialState , context ) ;
			}
		}
		else if ( stateProgram.returnAfter && stateProgram.returnErrorAction && (
			this.stateStack.length <= 1
			|| ( typeof stateProgram.returnAfter === 'string' && stateProgram.returnAfter !== state.openingState )
		) ) {
			// This is a return error (mostly parenthesis/brace/bracket parse errors)
			console.error( ">>> APPLY state returnErrorAction" , this.stateStack.length , stateProgram.returnAfter , state.openingState ) ;
			this.execActions( stateProgram.returnErrorAction , state , context ) ;
		}
		else if ( stateProgram.action ) {
			this.execActions( stateProgram.action , state , context ) ;
		}

	// Propagate the event to the next state now?
	} while ( stateHasSwitched && branchProgram?.propagate ) ;

	this.index ++ ;
} ;



// Get the first matching branchProgram
TextMachine.prototype.branchMatch = function( branches , event ) {
	if ( ! Array.isArray( branches ) ) { return ; }

	for ( let branchProgram of branches ) {
		let isMatching =
			branchProgram.matchType === MATCH_ALWAYS ? true :
			branchProgram.matchType === MATCH_STRING ? branchProgram.match === event :
			branchProgram.matchType === MATCH_SET ? branchProgram.match.has( event ) :
			branchProgram.matchType === MATCH_REGEXP ? branchProgram.match.test( event ) :
			branchProgram.matchType === MATCH_FUNCTION ? !! branchProgram.match( event ) :
			false ;

		if ( isMatching === ! branchProgram.inverse ) { return branchProgram ; }
	}
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
	console.error( "ACTION:" , actionName ) ;

	switch ( actionName ) {
		case 'style' :
			this.api.style( context , action[ 1 ] ) ;
			break ;
		case 'starterStyle' :
			console.error( "  -> " , state.startingStateContext.x , state.startingStateContext.y ) ;
			this.api.style( state.startingStateContext , action[ 1 ] ) ;
			break ;
		case 'openerStyle' :
			console.error( "  -> " , state.openingContext.x , state.openingContext.y ) ;
			this.api.style( state.openingContext , action[ 1 ] ) ;
			break ;
		case 'streakStyle' :
			this.api.blockStyle( state.startingStateContext , context , action[ 1 ] ) ;
			break ;
		case 'spanStyle' : {
			let span = state.span[ action[ 1 ] ] ;
			console.error( "  -> " , span ) ;
			if ( ! span ) { break ; }
			this.api.blockStyle( span.startingContext , span.endingContext , action[ 2 ] ) ;
			break ;
		}
		case 'hint' :
			// /!\ Should be refactored...
			this.api.hint( context , state.buffer , action[ 1 ] ) ;
			break ;
	}
} ;

