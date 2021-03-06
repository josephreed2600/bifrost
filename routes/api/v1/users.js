const logger = require('logger').get('users');
const api_ver = require('./api_ver');

let db, io, snowmachine;
const configure = (obj) => {
	db = obj['db'];
	io = obj['io'];
	snowmachine = obj['snowmachine'];
};

const handle = (code, req, res) => {
	return errors => {
		res
			.status(code)
			.json(errors)
	};
};

// verify 400/500
const createUser = (req, res) => {
	const errors = [];
	expect(req.body, ['name', 'icon_id', 'email', 'password'], errors);
	if (errors.length) res.status(400).json(errors);
	else {
		db.createUser(req.body.name, req.body.email, req.body.password, req.body.icon_id)
			.then(user => {
				res
					.status(201)
					.location(`${api_ver}/users/${user.user_id}`)
					.json(user);
				return user;
			})
			.then(user => {
				io.emit('create user', user);
				return user;
			})
			.catch(handle(500, req, res));
	}
};

// TODO add limit
// verify 400/500
const getUsers = (req, res) => {
	db.getUsers()
		.then(users => res.json(users))
		.catch(handle(500, req, res));
};

// verify 400/500
const getUser = (req, res) => {
	db.getUsers({user_id: req.params.user_id})
		.then(users => {
			if (!users.length) {
				if (req.params.user_id < snowmachine.generate().snowflake)
					res.sendStatus(410);
				else
					res.sendStatus(404);
			}
			else res.json(users[0]);
		})
		.catch(handle(500, req, res));
};

const updateUser = (req, res) => {
	db.updateUser(req.params.user_id, {
		name: req.body.name,
		email: req.body.email,
		password: req.body.password,
		icon_id: req.body.icon_id
	})
		.then(() => {
			res.statusMessage = 'Updated';
			res.status(204).end();
		})
		.then(() => {
			io.emit('update user');
		})
		.catch(handle(400, req, res));
};

const deleteUser = (req, res) => {
	db.deleteUser(req.params.user_id)
		.then(() => {
			res.statusMessage = 'Deleted';
			res.status(204).end();
		})
		.then(() => {
			io.emit('delete user');
		})
		.catch(handle(500, req, res));
};

const expect = (obj, names, errors) => {
	if (names.constructor.name !== 'Array')
		names = [names];
	for (let name of names)
		if (!obj.hasOwnProperty(name))
			errors.push(`${name} was expected, but was not provided`);
};

const routes = [
	{
		uri: '/api/v1/users',
		methods: ['post'],
		handler: createUser
	}
	, {
		uri: '/api/v1/users',
		methods: ['get'],
		handler: getUsers
	}
	, {
		uri: '/api/v1/users/:user_id',
		methods: ['get'],
		handler: getUser
	}
	, {
		uri: '/api/v1/users/:user_id',
		methods: ['put'],
		handler: updateUser
	}
	, {
		uri: '/api/v1/users/:user_id',
		methods: ['delete'],
		handler: deleteUser
	}
];


module.exports = { logger, routes, configure }
