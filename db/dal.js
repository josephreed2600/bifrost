#!/usr/bin/node
const logger = require('logger').get('dal');
const db = require('./db-connect');

// cassandra-driver:
// https://docs.datastax.com/en/developer/nodejs-driver/4.6/api/class.Client/

class Schema {
	constructor(name, keys = [], requireds = [], nullables = [], immutables = [], automatics = [], update_keys = [], typeSamples = {}, validators = [], permitNulls = false) {
		// e.g. 'guilds', 'channels_by_guild'
		// this is used as a table name for generating CQL
		this.name = name;
		// list of all column names
		this.keys = keys;
		// list of all columns who must be specified in any query:
		// both new records and updates to existing records _must_
		// have these keys
		this.requireds = requireds;
		// list of all columns whose values are not mandatory (may be
		// omitted when the record is created)
		// this list takes part in automatic validation
		this.nullables = nullables;
		// list of all columns whose values are immutable once a row has
		// been written
		this.immutables = immutables;
		// list of all columns whose values are generated by code in this
		// file, rather than supplied by the user/other areas of the
		// application
		// (e.g. snowflakes are generated here when a record is created)
		this.automatics = automatics;
		// list of all columns used to identify rows to be updated
		// used by this.getUpdateStmt
		this.update_keys = update_keys;
		// collection of type samples for type validation
		this.typeSamples = typeSamples;
		// list of functions that validate a schema
		// each function takes an object (proposed record) and a boolean
		// (whether to treat the object as a new record or a set of updates)
		// if the object is treated as a set of updates, some fields may be
		// omitted, whereas a new record must have all fields specified
		// (unless the record is okay with leaving things empty)
		// each function returns an array of zero or more strings, each of
		// which describes an error with the input
		this.validators = validators;
		// whether or not to ever permit a key to have a null value
		this.permitNulls = permitNulls;

		this.validators.push(Schema.getCheckForMissingKeys(this));
		this.validators.push(Schema.getCheckForTypeErrors(this));
	}

	trim(obj) {
		const out = {};
		this.keys.forEach(key => {out[key] = obj[key];});
		Object.keys(out).forEach(key => {
			if (out[key] === undefined) delete out[key];
		});
		return out;
	}

	validate(obj, isUpdate = false) {
		const errors = [];
		this.validators.forEach(v => {
			errors.push(...v(obj, isUpdate));
		});
		return errors;
	}

	get updatables() {
		return this.keys.filter(key => !this.immutables.includes(key));
	}

	getInsertStmt(record) {
		record = this.trim(record);
		const errors = this.validate(record, false);
		if (errors.length)
			throw errors;

		const columns = Object.keys(record);
		const params = columns.map(key => record[key]);

		const column_string = columns.join(', ');
		const value_string = columns.map(x => '?').join(', ');

		return [
			`INSERT INTO ${this.name} (${column_string}) VALUES (${value_string});`
			, params
			, { prepare: true }
		];
	}

	getSelectStmt() {
		return [
			`SELECT * FROM ${this.name};`
			, []
			, { prepare: true }
		];
	}

	getUpdateStmt(changes) {
		changes = this.trim(changes);
		const errors = this.validate(changes, true);
		if (errors.length)
			throw errors;

		const columns = [];
		const update_keys = [];
		const params = [];
		Object.keys(changes).forEach(key => {
			if (this.immutables.includes(key))
				update_keys.push(key);
			else
				columns.push(key);
		});
		for (let key of columns) params.push(changes[key]);
		for (let key of update_keys) params.push(changes[key]);
		const column_string = columns.map(c => c + ' = ?').join(', ');
		const key_string = update_keys.map(c => c + ' = ?').join(' AND ');

		return [
			`UPDATE ${this.name} SET ${column_string} WHERE ${key_string};`
			, params
			, { prepare: true }
		];
	}

	getDeleteStmt(criteria) {
		criteria = this.trim(criteria);
		const errors = [];
		// forbid deleting based on anything mutable
		for (let key of Object.keys(criteria))
			if (this.updatables.includes(key))
				errors.push(`DELETE criteria may only be immutable columns (${this.immutables.join(', ')}), but ${key} was supplied`);
		if (errors.length)
			throw errors;

		// deletion criteria are OK, so carry on
		const columns = Object.keys(criteria);
		const params = columns.map(key => criteria[key]);

		const criteria_string = columns.map(c => c + ' = ?').join(' AND ');
		return [
			`DELETE FROM ${this.name} WHERE ${criteria_string};`
			, params
			, { prepare: true }
		];
	}

	static getCheckForMissingKeys(_this) {
		return (obj, isUpdate) => {
			const errors = [];
			if (isUpdate) {
				// check that all requireds are supplied
				for (let key of _this.requireds)
					if (obj[key] === undefined) errors.push(`Key ${key} is required for an update, but was not supplied`);
				// check that all supplied keys are not null
				for (let key of _this.keys)
					if (!_this.permitNulls && obj[key] === null) errors.push(`Key ${key} is required for an update, but null was supplied`);
				// check that at least one mutable key is supplied
				// i.e., make sure we're actually updating something
				if (_this.keys
					.filter(key => !_this.immutables.includes(key))
					.filter(key => obj[key] !== undefined)
					.length === 0)
					errors.push(`At least one key besides [${_this.immutables.join(', ')}] must be supplied for an update, but none were`);
				else console.log(_this.keys
					.filter(key => !_this.immutables.includes(key))
					.filter(key => obj[key] !== undefined)
				);
			} else {
				// ensure that all keys that aren't optional are defined,
				// and also that all keys that are defined aren't null if nulls are not permitted
				// i.e., if !permitNulls, then an optional key can be anything but null
				for (let key of _this.keys)
					if (obj[key] === undefined && !_this.nullables.includes(key)) errors.push(`Key ${key} is required for a new record, but was not supplied`);
				else if (!_this.permitNulls && obj[key] === null) errors.push(`Key ${key} must not be null, but null was supplied`);
			}
			return errors;
		}
	}

	static getCheckForTypeErrors(_this) {
		return (obj, isUpdate) => {
			const errors = [];
			for (let key of Object.keys(_this.typeSamples))
				if (obj[key] !== undefined
					&& obj[key] !== null
					&& obj[key].constructor.name !== _this.typeSamples[key].constructor.name)
					errors.push(`Key ${key} must be of type ${_this.typeSamples[key].constructor.name}, but the supplied value ${obj[key]} is of type ${obj[key].constructor.name}`);
			return errors;
		}
	}

}

// oh no, what have i done
// name, keys, requireds, nullables, immutables, automatics, update keys, type samples, validators, permit nulls
const schemas = {
	guilds: new Schema('guilds'
		, ['guild_id', 'name', 'icon_id'] // keys
		, ['guild_id'] // requireds
		, [] // nullables
		, ['guild_id'] // immutables
		, ['guild_id'] // automatics
		, ['guild_id'] // update keys
		, { // type samples
			'guild_id': 0
			, 'name': ''
			, 'icon_id': 0
		}
	)
};

// returns description of guild, or throws
const createGuild = async (name, icon_snowflake) => {
	// FIXME generate real snowflakes
	const guild_snowflake = Math.round(Math.random() * 10000000);
	const record = {
		guild_id: guild_snowflake,
		name,
		icon_id: icon_snowflake
	};

	return db.execute(...schemas.guilds.getInsertStmt(record))
		.then(() => record);
};

// returns list of guild descriptions, or throws
// FIXME use the filtering options somewhere
// snowflakes for before, after; string for name fragment
const getGuilds = async (options) => {
	return db.execute(...schemas.guilds.getSelectStmt()).then(res => res.rows);
};

// returns or throws
const updateGuild = async (changes) => {
	return db.execute(...schemas.guilds.getUpdateStmt(changes)).then(() => {});
};

// returns or throws
const deleteGuild = async (guild_snowflake) => {
	return db.execute(...schemas.guilds.getDeleteStmt({guild_id: guild_snowflake})).then(() => {});
};

module.exports = {
	Schema, schemas
	, createGuild, getGuilds, updateGuild, deleteGuild
};
