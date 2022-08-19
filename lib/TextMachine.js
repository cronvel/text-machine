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

	// TODO
	//this.offset = 0 ;
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
	this.stateStack = [ {
		name: this.program.config.initState || 'init'
	} ] ;

	//this.offset = 0 ;
} ;



TextMachine.prototype.pushEvent = function( event , context ) {
	var initialState , state , previousState ,
		stateProgram , branchProgram , bufferBranchProgram ,
		primaryContext , startingStateContext , startingSpanContext , endingSpanContext ,
		delayedAction , buffer ,
		stateHasSwitched = false ;

	// Get the current state
	initialState = state = this.stateStack[ this.stateStack.length - 1 ] ;

	// Active state program
	stateProgram = this.program.states[ state.name ] ;

	delayedAction = false ;

	for ( ;; ) {
		branchProgram = this.branchMatch( stateProgram.branches , event ) ;
		if ( ! branchProgram ) { break ; }

		primaryContext = state.context ;
		startingStateContext = state.startingStateContext ;
		startingSpanContext = state.startingSpanContext ;
		endingSpanContext = state.endingSpanContext ;
		buffer = undefined ;

		if (
			( ! branchProgram.state || branchProgram.state === state.name ) &&
			! branchProgram.subState &&
			( ! branchProgram.return || this.stateStack.length <= 1 )
		) {
			// No state change

			state.previousName = state.name ;
			state.previousContext = state.context ;
			state.context = context ;

			if ( stateProgram.bufferBranches ) {
				state.buffer += event ;
			}
		}
		else if ( branchProgram.subState ) {
			// Sub-state recursion
			console.error( "ENTERING SUB STATE" , state.name , '-->' , branchProgram.subState ) ;

			stateHasSwitched = true ;
			stateProgram = this.program.states[ branchProgram.subState ] ;

			// Is it useful here???
			if ( stateProgram.clearSpan ) {
				startingSpanContext = state.startingSpanContext = null ;
				endingSpanContext = state.endingSpanContext = null ;
			}
			else {
				if ( stateProgram.startSpan ) { startingSpanContext = state.startingSpanContext = context ; }
				if ( stateProgram.endSpan ) { endingSpanContext = state.endingSpanContext = context ; }
			}

			// Save the entering context
			state.enteringContext = context ;
			state.enteringState = branchProgram.subState ;
			state.returnState = branchProgram.state ;

			// Create and push a new state
			previousState = state ;
			state = {
				name: branchProgram.subState ,
				context: context ,
				startingStateContext: branchProgram.continue ? previousState.startingStateContext : context
			} ;

			this.stateStack.push( state ) ;
		}
		else if ( branchProgram.return && this.stateStack.length > 1 ) {
			// Return from sub-state recursion
			console.error( "RETURN" , state.name , '-->' , branchProgram.return , '|' , this.stateStack[ this.stateStack.length - 2 ].enteringState , '-->' , this.stateStack[ this.stateStack.length - 2 ].returnState ) ;

			stateHasSwitched = true ;
			this.stateStack.pop() ;

			previousState = state ;
			state = this.stateStack[ this.stateStack.length - 1 ] ;
			let errorAction = null ;

			// Should be done BEFORE returnState
			if ( typeof branchProgram.return === 'string' && branchProgram.return !== state.enteringState ) {
				// We are returning from an unexpected subState
				if ( branchProgram.errorAction ) { errorAction = branchProgram.errorAction ; }
			}

			if ( state.returnState ) {
				// Overwrite the old state with the new one
				state = this.stateStack[ this.stateStack.length - 1 ] = {
					name: state.returnState ,
					previousName: state.name ,
					context: context ,
					previousContext: state.context ,
					enteringContext: state.enteringContext ,		// /!\ This whole thing is bad
					startingStateContext: state.startingStateContext ,
					startingSpanContext: state.startingSpanContext ,
					endingSpanContext: state.endingSpanContext
				} ;
			}

			stateProgram = this.program.states[ state.name ] ;
			startingStateContext = state.enteringContext ;
			startingSpanContext = state.startingSpanContext ;
			endingSpanContext = state.endingSpanContext ;
		}
		else {
			// To next state

			stateHasSwitched = true ;
			let errorAction = null ;

			if ( branchProgram.return ) {
				// We are in a state where we cannot return
				if ( branchProgram.errorAction ) { errorAction = branchProgram.errorAction ; }
			}

			bufferBranchProgram = this.branchMatch( stateProgram.bufferBranches , state.buffer ) ;

			// /!\ Seems really bad to extend this... /!\
			// Also it seems more appropriate to just replace it
			if ( bufferBranchProgram ) {
				buffer = state.buffer ;
				branchProgram = Object.assign( {} , branchProgram , bufferBranchProgram ) ;
			}

			if ( branchProgram.delay ) {
				delayedAction = stateProgram.action ;
			}

			stateProgram = this.program.states[ branchProgram.state ] ;

			if ( stateProgram.clearSpan ) {
				startingSpanContext = state.startingSpanContext = null ;
				endingSpanContext = state.endingSpanContext = null ;
			}
			else {
				if ( stateProgram.startSpan ) { startingSpanContext = state.startingSpanContext = context ; }
				if ( stateProgram.endSpan ) { endingSpanContext = state.endingSpanContext = context ; }
			}

			// Exec the branch/switching state action now, if any...
			this.execActions( errorAction || branchProgram.action , state , buffer ) ;

			// Overwrite the old state with the new one
			previousState = state ;
			state = this.stateStack[ this.stateStack.length - 1 ] = {
				name: branchProgram.state ,
				previousName: state.name ,
				context: context ,
				previousContext: state.context ,
				startingStateContext: branchProgram.continue ? previousState.startingStateContext : context ,
				startingSpanContext: state.startingSpanContext ,
				endingSpanContext: state.endingSpanContext
			} ;

			if ( stateProgram.bufferBranches ) {
				state.buffer = branchProgram.preserveBuffer ? previousState.buffer + event : event ;
			}
		}

		// Exec the branch/switching state action now, if any...
		if ( errorAction ) {
			this.execActions( errorAction , primaryContext , startingStateContext , startingSpanContext , endingSpanContext , buffer ) ;
		}
		else if ( branchProgram.action ) {
			this.execActions( branchProgram.action , primaryContext , startingStateContext , startingSpanContext , endingSpanContext , buffer ) ;
		}

		// Should come AFTER actions
		if ( branchProgram.clearSpan ) {
			startingSpanContext = state.startingSpanContext = null ;
			endingSpanContext = state.endingSpanContext = null ;
		}
		else {
			if ( branchProgram.startSpan ) { startingSpanContext = state.startingSpanContext = context ; }
			if ( branchProgram.endSpan ) { endingSpanContext = state.endingSpanContext = context ; }
		}

		// Propagate the event to the next state now?
		if ( ! stateHasSwitched || ! branchProgram.propagate ) { break ; }
	}


	// Exec the finishing state action, if any...
	if ( delayedAction !== false ) { this.execActions( delayedAction , context , undefined , startingSpanContext , endingSpanContext ) ; }
	else if ( stateProgram.action ) { this.execActions( stateProgram.action , context , undefined , startingSpanContext , endingSpanContext ) ; }
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
			branchProgram.matchType === MATCH_FUNCTION ? !! match( event ) :
			false ;
		
		if ( isMatching === ! branchProgram.inverse ) { return branchProgram ; }
	}
} ;



TextMachine.prototype.execActions = function( context , actions , state , buffer ) {
	if ( ! actions || ! actions.length ) { return ; }

	if ( ! Array.isArray( actions[ 0 ] ) ) {
		this.execAction( actions , state , buffer ) ;
	}

	for ( let action of actions ) {
		this.execAction( action , state , buffer ) ;
	}
} ;



TextMachine.prototype.execAction = function( action , state , buffer ) {
	var actionName = action[ 0 ] ;

	context.startingContext = startingStateContext ;	// /!\ !!!TEMP!!! /!\
	context.startingStateContext = startingStateContext ;

	context.startingSpanContext = startingSpanContext ;
	context.endingSpanContext = endingSpanContext ;
	context.buffer = buffer ;

	switch ( actionName ) {
		case 'style' :
			this.api.style( context , action[ 1 ] ) ;
			break ;
		case 'starterStyle' :
			this.api.style( state.startingStateContext , action[ 1 ] ) ;
			break ;
		case 'streakStyle' :
			this.api.blockStyle( context , state.startingStateContext , action[ 1 ] ) ;
			break ;
		case 'spanStyle' :
			this.api.blockStyle( state.endingSpanContext || context , state.startingStateContext , action[ 1 ] ) ;
			break ;
		case 'hint' :
			// /!\ Should be refactored...
			this.api.hint( context , action[ 1 ] ) ;
			break ;
		default :
			this.api[ actionName ]( context , action[ 1 ] , action[ 2 ] , action[ 3 ] ) ;
			break ;
	}
} ;

