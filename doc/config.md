
## State properties

* action: `Array` with the action name and its arguments, OR an array of that (if multiple actions should be issued).
  State's actions are applied upon entering a state, but after the branching action
* branches: `Array` of branch object (see branch properties below).
  The first branch that match is selected.
* bufferBranches: like `branches`, but match a buffer instead of the event-character.
* startSpan:
* endSpan:
* clearSpan:



## Branch properties

* match: used to match an event-character, can be of multiple type:
	* true: always match, used as fallback on the last branch
	* string: perfect match
	* array: match if one of its element match
	* regexp: match if the regexp match
	* function: a userland function used for matching
* action: `Array` with the action name and its arguments, OR an array of that (if multiple actions should be issued).
  Branch's actions are applied before entering the new state (before the new state action)
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
* startSpan:
* endSpan:
* clearSpan:
* continue: DEPRECATED
