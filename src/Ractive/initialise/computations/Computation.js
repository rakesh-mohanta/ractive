import warn from 'utils/warn';
import runloop from 'global/runloop';
import set from 'shared/set';
import Watcher from 'Ractive/initialise/computations/Watcher';

var Computation = function ( ractive, key, signature ) {
	this.ractive = ractive;
	this.key = key;

	this.getter = signature.get;
	this.setter = signature.set;

	this.watchers = [];

	this.update();
};

Computation.prototype = {
	set: function ( value ) {
		if ( this.setting ) {
			this.value = value;
			return;
		}

		if ( !this.setter ) {
			throw new Error( 'Computed properties without setters are read-only in the current version' );
		}

		this.setter.call( this.ractive, value );
	},

	// returns `false` if the computation errors
	compute: function () {
		var ractive, originalCaptured, errored;

		ractive = this.ractive;
		originalCaptured = ractive._captured;

		if ( !originalCaptured ) {
			ractive._captured = [];
		}

		try {
			this.value = this.getter.call( ractive );
		} catch ( err ) {
			if ( ractive.debug ) {
				warn( 'Failed to compute "' + this.key + '": ' + err.message || err );
			}

			errored = true;
		}

		diff( this, this.watchers, ractive._captured );

		// reset
		ractive._captured = originalCaptured;

		return errored ? false : true;
	},

	update: function () {
		if ( this.compute() ) {
			this.setting = true;
			set( this.ractive, this.key, this.value );
			this.setting = false;
		}

		this.deferred = false;
	},

	bubble: function () {
		if ( this.watchers.length <= 1 ) {
			this.update();
		}

		else if ( !this.deferred ) {
			runloop.addComputation( this );
			this.deferred = true;
		}
	}
};

function diff ( computation, watchers, newDependencies ) {
	var i, watcher, keypath;

	// remove dependencies that are no longer used
	i = watchers.length;
	while ( i-- ) {
		watcher = watchers[i];

		if ( !newDependencies[ watcher.keypath ] ) {
			watchers.splice( i, 1 );
			watchers[ watcher.keypath ] = null;

			watcher.teardown();
		}
	}

	// create references for any new dependencies
	i = newDependencies.length;
	while ( i-- ) {
		keypath = newDependencies[i];

		if ( !watchers[ keypath ] ) {
			watcher = new Watcher( computation, keypath );
			watchers.push( watchers[ keypath ] = watcher );
		}
	}
}

export default Computation;
