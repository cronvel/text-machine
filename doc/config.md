
## State properties

* action: `Array` with the action name and its arguments, OR an array of that (if multiple actions should be issued).
  State's actions are applied upon entering a state, but after the branching action
* returnErrorAction: `Array` with the action name and its arguments, OR an array of that (if multiple actions should be issued).
  If returning on an incorrect state, use thoses actions instead of regular state's actions.
  Used for parse error styling (e.g. parse error when a closing parenthesis/bracket/brace/etc does not match an opening one).
* returnAfter: `true` or `string` if set it returns to the parent-state automatically *after*, i.e. on the next event-character,
  if a string is provided the parent-state's name should match that string, or it will be considered as a parse error,
  and will use the *returnErrorAction* property instead of the *action* property.
  It's mostly the same than branch's *return* property, except that *returnErrorAction* trigger immediately if it should.
* branches: `Array` of branch object (see branch properties below).
  The first branch that match is selected.
* bufferBranches: like `branches`, but match a buffer instead of the event-character.
  **Only checked/matched on state switching**.
  If matched, its *program* replaces the matching branch.
* span: `string` start or continue a span with the identified by the given name.
  For a span to continue, it must be contiguous.
  *Spans* define areas that can be styled with the *spanStyle* action.
* microState: `object` set/unset some micro-states, key: micro-state name, value: `boolean` or `number` or `string` (true/number/string: set, false: unset).
* storeInMicroState: `string` store the current buffer into that micro-state



## Branch properties

* match: used to match an event-character, can be of multiple type:
	* true: always match, used as fallback on the last branch
	* string: perfect match
	* array: match if one of its element match
	* regexp: match if the regexp match
	* function: a userland function used for matching
* hasMicroState: `string` or `object` or `Array` of `string`, if set to a micro-state's name, the branch will only match if the current state
  has this micro-state turned on, if it's an array, all micro-states specified should be turned on, if it's an object, all micro-states specified as the *key*
  must have matching *values*.
* microState: `object` set/unset some micro-states, key: micro-state name, value: `boolean` or `number` or `string` (true/number/string: set, false: unset).
* storeInMicroState: `string` store the current buffer into that micro-state
* action: `Array` with the action name and its arguments, OR an array of that (if multiple actions should be issued).
  Branch's actions are applied before entering the new state (before the new state action)
* store: `string` (store's name) or `Array` of `string` (list of store's names): store the current buffer into the store,
  a store being a Javascript `Set`, and is used by the host program for things like populating auto-completion, or whatever.
* returnErrorAction: `Array` with the action name and its arguments, OR an array of that (if multiple actions should be issued).
  If returning on an incorrect state, use thoses actions instead of regular branch's actions.
  Used for parse error styling (e.g. parse error when a closing parenthesis/bracket/brace/etc does not match an opening one).
* state: `string` switch to that state
* subState: `string` gosub to this state (recursion), it will return on the parent-state once a matching branch will have
  a *return* property
* return: `true` or `string` if set it returns to the parent-state, if a string is provided the parent-state's name should match
  that string, or it will be considered as a parse error, and will use the *returnErrorAction* property instead of
  the *action* property.
* propagate: `boolean` if set, the event-character is issued again after the state have changed,
  i.e. the matching character is not eaten is re-used by the new state
* delay: `boolean` if set, the action of the state before branching will be used this time, instead of those of the new state

MAYBE:
* overide: `boolean` if set, the branch's action replace the next state's action once

