/*
 * Copyright (C) 2016  Max Prettyjohns
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

import * as testData from '../data/test-data.js';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {expectAchievementIds} from './common';
import orm from './bookbrainz-data';
import rewire from 'rewire';


chai.use(chaiAsPromised);
const {expect} = chai;
const {Editor} = orm;

const Achievement = rewire('../lib/server/helpers/achievement.js');

const hotOffThePressThreshold = -7;

export default function tests() {
	beforeEach(() => testData.createEditor()
		.then(() =>
			testData.createHotOffThePress()
		)
	);

	afterEach(testData.truncate);

	it('should be given to someone with edition revision released this week',
		() => {
			Achievement.__set__({
				getEditionDateDifference: () =>
					Promise.resolve(hotOffThePressThreshold)
			});

			const achievementPromise =
				new Editor({name: testData.editorAttribs.name})
					.fetch()
					.then((editor) =>
						Achievement.processEdit(orm, editor.id)
					)
					.then((edit) =>
						edit.hotOffThePress['Hot Off the Press']
					);

			return expectAchievementIds(
				achievementPromise,
				testData.editorAttribs.id,
				testData.hotOffThePressAttribs.id
			);
		}
	);

	it('shouldn\'t be given when edition revision released a week ago',
		() => {
			Achievement.__set__({
				getEditionDateDifference: () =>
					Promise.resolve(hotOffThePressThreshold - 1)
			});

			const achievementPromise =
				new Editor({name: testData.editorAttribs.name})
					.fetch()
					.then((editor) =>
						Achievement.processEdit(orm, editor.id)
					)
					.then((edit) =>
						edit.timeTraveller['Time Traveller']
					);

			return expect(achievementPromise).to.eventually.equal(false);
		});
}
