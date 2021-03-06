/*
 * Copyright (C) 2015       Ben Ockmore
 *               2015-2016  Sean Burke
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

import * as auth from '../../helpers/auth';
import * as entityEditorHelpers from '../../../client/entity-editor/helpers';
import * as entityRoutes from './entity';
import * as error from '../../helpers/error';
import * as middleware from '../../helpers/middleware';
import * as propHelpers from '../../../client/helpers/props';
import * as utils from '../../helpers/utils';
import {escapeProps, generateProps} from '../../helpers/props';
import EntityEditor from '../../../client/entity-editor/entity-editor';
import Immutable from 'immutable';
import Layout from '../../../client/containers/layout';
import {Provider} from 'react-redux';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import _ from 'lodash';
import {createStore} from 'redux';
import express from 'express';


const {createRootReducer, getEntitySection, getValidator} = entityEditorHelpers;

const router = express.Router();

/* If the route specifies a BBID, load the Work for it. */
router.param(
	'bbid',
	middleware.makeEntityLoader(
		'Work',
		['workType', 'languageSet.languages'],
		'Work not found'
	)
);

function _setWorkTitle(res) {
	res.locals.title = utils.createEntityPageTitle(
		res.locals.entity,
		'Work',
		utils.template`Work “${'name'}”`
	);
}

router.get('/:bbid', middleware.loadEntityRelationships, (req, res) => {
	_setWorkTitle(res);
	entityRoutes.displayEntity(req, res);
});

router.get('/:bbid/delete', auth.isAuthenticated, (req, res) => {
	_setWorkTitle(res);
	entityRoutes.displayDeleteEntity(req, res);
});

router.post('/:bbid/delete/handler', auth.isAuthenticatedForHandler,
	(req, res) => {
		const {orm} = req.app.locals;
		const {WorkHeader, WorkRevision} = orm;
		return entityRoutes.handleDelete(
			orm, req, res, WorkHeader, WorkRevision
		);
	}
);

router.get('/:bbid/revisions', (req, res, next) => {
	const {WorkRevision} = req.app.locals.orm;
	_setWorkTitle(res);
	entityRoutes.displayRevisions(req, res, next, WorkRevision);
});

// Creation

router.get('/create', auth.isAuthenticated, middleware.loadIdentifierTypes,
	middleware.loadLanguages, middleware.loadWorkTypes,
	(req, res) => {
		const props = generateProps(req, res, {
			entityType: 'work',
			heading: 'Create Work',
			identifierTypes: res.locals.identifierTypes,
			initialState: {},
			languageOptions: res.locals.languages,
			requiresJS: true,
			subheading: 'Add a new Work to BookBrainz',
			submissionUrl: '/work/create/handler',
			workTypes: res.locals.workTypes
		});

		const {initialState, ...rest} = props;

		const rootReducer = createRootReducer(props.entityType);

		const store = createStore(
			rootReducer,
			Immutable.fromJS(initialState)
		);

		const EntitySection = getEntitySection(props.entityType);

		const markup = ReactDOMServer.renderToString(
			<Layout {...propHelpers.extractLayoutProps(rest)}>
				<Provider store={store}>
					<EntityEditor
						validate={getValidator(props.entityType)}
						{...propHelpers.extractChildProps(rest)}
					>
						<EntitySection/>
					</EntityEditor>
				</Provider>
			</Layout>
		);

		props.initialState = store.getState();

		return res.render('target', {
			markup,
			props: escapeProps(props),
			script: '/js/entity-editor.js',
			title: 'Add Work'
		});
	}
);

function getDefaultAliasIndex(aliases) {
	const index = aliases.findIndex((alias) => alias.default);
	return index > 0 ? index : 0;
}

function workToFormState(work) {
	const aliases = work.aliasSet ?
		work.aliasSet.aliases.map(({language, ...rest}) => ({
			language: language.id,
			...rest
		})) : [];

	const defaultAliasIndex = getDefaultAliasIndex(aliases);
	const defaultAliasList = aliases.splice(defaultAliasIndex, 1);

	const aliasEditor = {};
	aliases.forEach((alias) => { aliasEditor[alias.id] = alias; });

	const buttonBar = {
		aliasEditorVisible: false,
		disambiguationVisible: Boolean(work.disambiguation),
		identifierEditorVisible: false
	};

	const nameSection = _.isEmpty(defaultAliasList) ? {
		language: null,
		name: '',
		sortName: ''
	} : defaultAliasList[0];
	nameSection.disambiguation =
		work.disambiguation && work.disambiguation.comment;

	const identifiers = work.identifierSet ?
		work.identifierSet.identifiers.map(({type, ...rest}) => ({
			type: type.id,
			...rest
		})) : [];

	const identifierEditor = {};
	identifiers.forEach(
		(identifier) => { identifierEditor[identifier.id] = identifier; }
	);

	const workSection = {
		languages: work.languageSet ? work.languageSet.languages.map(
			({id, name}) => ({label: name, value: id})
		) : [],
		type: work.workType && work.workType.id
	};

	return {
		aliasEditor,
		buttonBar,
		identifierEditor,
		nameSection,
		workSection
	};
}

router.get('/:bbid/edit', auth.isAuthenticated, middleware.loadIdentifierTypes,
	middleware.loadWorkTypes, middleware.loadLanguages,
	(req, res) => {
		const work = res.locals.entity;

		workToFormState(work);

		const props = generateProps(req, res, {
			entityType: 'work',
			heading: 'Edit Work',
			identifierTypes: res.locals.identifierTypes,
			initialState: workToFormState(work),
			languageOptions: res.locals.languages,
			requiresJS: true,
			subheading: 'Edit an existing Work in BookBrainz',
			submissionUrl: `/work/${work.bbid}/edit/handler`,
			workTypes: res.locals.workTypes
		});

		const {initialState, ...rest} = props;

		const rootReducer = createRootReducer(props.entityType);

		const store = createStore(
			rootReducer,
			Immutable.fromJS(initialState)
		);

		const EntitySection = getEntitySection(props.entityType);

		const markup = ReactDOMServer.renderToString(
			<Layout {...propHelpers.extractLayoutProps(rest)}>
				<Provider store={store}>
					<EntityEditor
						validate={getValidator(props.entityType)}
						{...propHelpers.extractChildProps(rest)}
					>
						<EntitySection/>
					</EntityEditor>
				</Provider>
			</Layout>
		);

		props.initialState = store.getState();

		return res.render('target', {
			markup,
			props: escapeProps(props),
			script: '/js/entity-editor.js',
			title: 'Add Work'
		});
	}
);

function getAdditionalWorkSets(orm) {
	const {LanguageSet} = orm;
	return [
		{
			entityIdField: 'languageSetId',
			idField: 'id',
			model: LanguageSet,
			name: 'languageSet',
			propName: 'languages'
		}
	];
}


function transformNewForm(data) {
	const aliases = entityRoutes.constructAliases(
		data.aliasEditor, data.nameSection
	);

	const identifiers = entityRoutes.constructIdentifiers(
		data.identifierEditor
	);

	const languages = _.map(
		data.workSection.languages, (language) => language.value
	);

	return {
		aliases,
		disambiguation: data.nameSection.disambiguation,
		identifiers,
		languages,
		note: data.submissionSection.note,
		typeId: data.workSection.type
	};
}

router.post('/create/handler', auth.isAuthenticatedForHandler, (req, res) => {
	const {orm} = req.app.locals;

	const validate = getValidator('work');
	if (!validate(req.body)) {
		const err = new error.FormSubmissionError();
		error.sendErrorAsJSON(res, err);
	}

	req.body = transformNewForm(req.body);
	return entityRoutes.createEntity(
		req, res, 'Work', _.pick(req.body, 'typeId'), getAdditionalWorkSets(orm)
	);
});

router.post('/:bbid/edit/handler', auth.isAuthenticatedForHandler,
	(req, res) => {
		const {orm} = req.app.locals;

		const validate = getValidator('work');
		if (!validate(req.body)) {
			const err = new error.FormSubmissionError();
			error.sendErrorAsJSON(res, err);
		}

		req.body = transformNewForm(req.body);
		return entityRoutes.editEntity(
			req, res, 'Work', _.pick(req.body, 'typeId'),
			getAdditionalWorkSets(orm)
		);
	}
);

export default router;
