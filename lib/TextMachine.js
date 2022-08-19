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
	var currentState , oldState ,
		stateProgram , branchProgram , bufferBranchProgram ,
		primaryContext , startingContext , startingSpanContext , endingSpanContext ,
		delayedAction , errorAction , actionBuffer ,
		stateHasSwitched = false ;

	// Get the current state
	currentState = this.stateStack[ this.stateStack.length - 1 ] ;

	// Active state program
	stateProgram = this.program.states[ currentState.name ] ;

	delayedAction = false ;

	for ( ;; ) {
		branchProgram = this.branchMatch( stateProgram.branches , event ) ;

		if ( ! branchProgram ) { break ; }

		primaryContext = currentState.context ;
		startingContext = currentState.startingContext ;
		startingSpanContext = currentState.startingSpanContext ;
		endingSpanContext = currentState.endingSpanContext ;
		errorAction = undefined ;
		actionBuffer = undefined ;

		if (
			( ! branchProgram.state || branchProgram.state === currentState.name ) &&
			! branchProgram.subState &&
			( ! branchProgram.return || this.stateStack.length <= 1 )
		) {
			// No state change

			currentState.previousName = currentState.name ;
			currentState.previousContext = currentState.context ;
			currentState.context = context ;

			if ( stateProgram.bufferBranches ) {
				currentState.buffer += event ;
			}
		}
		else if ( branchProgram.subState ) {
			// Sub-state recursion
			console.error( "ENTERING SUB STATE" , currentState.name , '-->' , branchProgram.subState ) ;

			stateHasSwitched = true ;
			stateProgram = this.program.states[ branchProgram.subState ] ;

			// Is it useful here???
			if ( stateProgram.clearSpan ) {
				startingSpanContext = currentState.startingSpanContext = null ;
				endingSpanContext = currentState.endingSpanContext = null ;
			}
			else {
				if ( stateProgram.startSpan ) { startingSpanContext = currentState.startingSpanContext = context ; }
				if ( stateProgram.endSpan ) { endingSpanContext = currentState.endingSpanContext = context ; }
			}

			// Save the entering context
			currentState.enteringContext = context ;
			currentState.enteringState = branchProgram.subState ;
			currentState.returnState = branchProgram.state ;

			// Create and push a new state
			oldState = currentState ;
			currentState = {
				name: branchProgram.subState ,
				context: context ,
				startingContext: branchProgram.continue ? oldState.startingContext : context
			} ;

			this.stateStack.push( currentState ) ;
		}
		else if ( branchProgram.return && this.stateStack.length > 1 ) {
			// Return from sub-state recursion
			console.error( "RETURN" , currentState.name , '-->' , branchProgram.return , '|' , this.stateStack[ this.stateStack.length - 2 ].enteringState , '-->' , this.stateStack[ this.stateStack.length - 2 ].returnState ) ;

			stateHasSwitched = true ;
			this.stateStack.pop() ;

			oldState = currentState ;
			currentState = this.stateStack[ this.stateStack.length - 1 ] ;

			// Should be done BEFORE returnState
			if ( typeof branchProgram.return === 'string' && branchProgram.return !== currentState.enteringState ) {
				// We are returning from an unexpected subState
				if ( branchProgram.errorAction ) { errorAction = branchProgram.errorAction ; }
			}

			if ( currentState.returnState ) {
				// Overwrite the old state with the new one
				currentState = this.stateStack[ this.stateStack.length - 1 ] = {
					name: currentState.returnState ,
					previousName: currentState.name ,
					context: context ,
					previousContext: currentState.context ,
					enteringContext: currentState.enteringContext ,		// /!\ This whole thing is bad
					startingContext: currentState.startingContext ,
					startingSpanContext: currentState.startingSpanContext ,
					endingSpanContext: currentState.endingSpanContext
				} ;
			}

			stateProgram = this.program.states[ currentState.name ] ;
			startingContext = currentState.enteringContext ;
			startingSpanContext = currentState.startingSpanContext ;
			endingSpanContext = currentState.endingSpanContext ;
		}
		else {
			// To next state

			stateHasSwitched = true ;
			if ( branchProgram.return ) {
				// We are in a state where we cannot return
				if ( branchProgram.errorAction ) { errorAction = branchProgram.errorAction ; }
			}

			bufferBranchProgram = this.branchMatch( stateProgram.bufferBranches , currentState.buffer ) ;

			// /!\ Seems really bad to extend this... /!\
			// Also it seems more appropriate to just replace it
			if ( bufferBranchProgram ) {
				actionBuffer = currentState.buffer ;
				branchProgram = Object.assign( {} , branchProgram , bufferBranchProgram ) ;
			}

			if ( branchProgram.delay ) {
				delayedAction = stateProgram.action ;
			}

			stateProgram = this.program.states[ branchProgram.state ] ;

			if ( stateProgram.clearSpan ) {
				startingSpanContext = currentState.startingSpanContext = null ;
				endingSpanContext = currentState.endingSpanContext = null ;
			}
			else {
				if ( stateProgram.startSpan ) { startingSpanContext = currentState.startingSpanContext = context ; }
				if ( stateProgram.endSpan ) { endingSpanContext = currentState.endingSpanContext = context ; }
			}

			// Overwrite the old state with the new one
			oldState = currentState ;
			currentState = this.stateStack[ this.stateStack.length - 1 ] = {
				name: branchProgram.state ,
				previousName: currentState.name ,
				context: context ,
				previousContext: currentState.context ,
				startingContext: branchProgram.continue ? oldState.startingContext : context ,
				startingSpanContext: currentState.startingSpanContext ,
				endingSpanContext: currentState.endingSpanContext
			} ;

			if ( stateProgram.bufferBranches ) {
				currentState.buffer = branchProgram.preserveBuffer ? oldState.buffer + event : event ;
			}
		}

		// Exec the switching state action now, if any...
		if ( errorAction ) {
			this.execActions( errorAction , primaryContext , startingContext , startingSpanContext , endingSpanContext , actionBuffer ) ;
		}
		else if ( branchProgram.action ) {
			this.execActions( branchProgram.action , primaryContext , startingContext , startingSpanContext , endingSpanContext , actionBuffer ) ;
		}

		// Should come AFTER actions
		if ( branchProgram.clearSpan ) {
			startingSpanContext = currentState.startingSpanContext = null ;
			endingSpanContext = currentState.endingSpanContext = null ;
		}
		else {
			if ( branchProgram.startSpan ) { startingSpanContext = currentState.startingSpanContext = context ; }
			if ( branchProgram.endSpan ) { endingSpanContext = currentState.endingSpanContext = context ; }
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



TextMachine.prototype.execActions = function( actions , context , startingContext , startingSpanContext , endingSpanContext , buffer ) {
	if ( ! actions || ! actions.length ) { return ; }

	if ( ! Array.isArray( actions[ 0 ] ) ) {
		this.execAction( actions , context , startingContext , startingSpanContext , endingSpanContext , buffer ) ;
	}

	for ( let action of actions ) {
		this.execAction( action , context , startingContext , startingSpanContext , endingSpanContext , buffer ) ;
	}
} ;



TextMachine.prototype.execAction = function( action , context , startingContext , startingSpanContext , endingSpanContext , buffer ) {
	if ( this.api[ action[ 0 ] ] ) {
		context.startingContext = startingContext ;
		context.startingSpanContext = startingSpanContext ;
		context.endingSpanContext = endingSpanContext ;
		context.buffer = buffer ;

		if ( ! Array.isArray( action[ 1 ] ) ) {
			// Pack action's argument once
			action[ 1 ] = action.slice( 1 ) ;
		}

		this.api[ action[ 0 ] ]( context , ... action[ 1 ] ) ;
	}
} ;

