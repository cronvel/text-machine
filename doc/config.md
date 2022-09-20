
## State properties

* action: `Array` with the action name and its arguments, OR an array of that (if multiple actions should be issued).
  State's actions are applied upon entering a state, but after the branching action
* return: `true` or `object` if set it returns to the parent-state automatically *after*, i.e. on the next event-character,
  if an object is provided, it could contains the following keys:
	* matchState: the parent-state's name should match that string, or it will be considered as a parse error
	* matchMicroState: the parent's micro-states should match, or it will be considered as a parse error
	* errorAction: like an *action*, but will be used instead if any error occurs (mismatching state or micro-state)
  It's mostly the same than branch's *return* property, except that *return.errorAction* trigger immediately if it should.
* branches: `Array` of branch object (see branch properties below).
  The first branch that match is selected.
* bufferBranches: like `branches`, but match a buffer instead of the event-character.
  **Only checked/matched on state switching**.
  If matched, its *program* replaces the matching branch.
  Force `buffer=true`.
* buffer: `boolean` if set, start accumulating into a buffer until the state-change
* span: `string` start or continue a span with the identified by the given name.
  For a span to continue, it must be contiguous.
  *Spans* define areas that can be styled with the *spanStyle* action, or *returnSpanStyle*.
* startSpan: same than *span*, but force a new span even if contiguous with a former one.
* expandSpan: same than *span*, but force continuing an existing span even if not contiguous with a former one: the former one is expanded toward the current position.
* microState: `object` set/unset some micro-states, key: micro-state name, value: `boolean` or `number` or `string` (true/number/string: set, false: unset).
* storeInMicroState: `string` store the current buffer into that micro-state



## Branch properties

* match: used to match an event-character, can be of multiple type:
	* true: always match, used as fallback on the last branch
	* string: perfect match
	* array: match if one of its element match
	* regexp: match if the regexp match
	* function: a userland function used for matching
* matchMicroState: `string` or `object` or `Array` of `string`, if set to a micro-state's name, the branch will only match if the current state
  has this micro-state turned on, if it's an array, all micro-states specified should be turned on, if it's an object, all micro-states specified as the *key*
  must have matching *values*.
* microState: `object` set/unset some micro-states, key: micro-state name, value: `boolean` or `number` or `string` (true/number/string: set, false: unset).
* action: `Array` with the action name and its arguments, OR an array of that (if multiple actions should be issued).
  Branch's actions are applied before entering the new state (before the new state action)
* store: `string` (store's name) or `Array` of `string` (list of store's names): store the current buffer into the store,
  a store being a Javascript `Set`, and is used by the host program for things like populating auto-completion, or whatever.
* state: `string` switch to that state
* subState: `string` gosub to this state (recursion), it will return on the parent-state once a matching branch will have
  a *return* property
* return: `true` or `object` if set it returns to the parent-state automatically *after*, i.e. on the next event-character,
  if an object is provided, it could contains the following keys:
	* matchState: the parent-state's name should match that string, or it will be considered as a parse error
	* matchMicroState: the parent's micro-states should match, or it will be considered as a parse error
	* errorAction: like an *action*, but will be used instead if any error occurs (mismatching state or micro-state)
  It's mostly the same than branch's *return* property, except that *return.errorAction* trigger immediately if it should.
* propagate: `boolean` if set, the event-character is issued again after the state have changed,
  i.e. the matching character is not eaten is re-used by the new state
* delay: `boolean` if set, the action of the state before branching will be used this time, instead of those of the new state
* preserveBuffer: `boolean` if set, the buffer is preserved across the state-change

MAYBE:
* overide: `boolean` if set, the branch's action replace the next state's action once
* clearSpan: `true` or `string` or `Array` of `string`, if set to true, clear all span, if a string, clear only this specific span, if an array of string, clear
  all specified span.



## SPECIAL DYNAMIC VALUES:

It's possible for `microState` and `matchMicroState` to pass an array instead of the number/string, that will provide a dynamic.

* If the #0 element is 'buffer', then it will be replaced by the current value of the buffer.
* If the #0 element is 'microState' and there is a #1 element, then it will be replaced by the current value of the micro-state having #1 as its name.



## TODO:

* Replace *buffer* by the more generic and flexible *span* everywhere...

