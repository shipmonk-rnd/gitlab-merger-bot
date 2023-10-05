import { defaultConfig } from '../Config';
import { isMergeRequestFromSupportedProject, prepareMergeRequestForMerge } from '../MergeRequestReceiver';
import { User, MergeRequest, MergeStatus, MergeState} from '../GitlabApi';
import { Worker } from '../Worker';
import { PubSub } from 'apollo-server';

import {GitlabApi} from '../GitlabApi';

it('discard external MR', async () => {
	expect(
		isMergeRequestFromSupportedProject('1', {
			...defaultConfig,
			PROJECT_IDS: undefined,
		}),
	).toBe(true);

	expect(
		isMergeRequestFromSupportedProject('1', {
			...defaultConfig,
			PROJECT_IDS: ['1'],
		}),
	).toBe(true);

	expect(
		isMergeRequestFromSupportedProject('2', {
			...defaultConfig,
			PROJECT_IDS: ['1', '2', '3'],
		}),
	).toBe(true);

	expect(
		isMergeRequestFromSupportedProject('0', {
			...defaultConfig,
			PROJECT_IDS: ['2'],
		}),
	).toBe(false);
});


describe('Test prepareMergeRequestForMerge', () => {
	test('Should not process if the merge request is from an unsupported project', async () => {

		// jest.mock('../GitlabApi', () => {
		// 	return jest.fn().mockImplementation(() => {
		// 		return {
		// 			updateMergeRequest: jest.fn(),
		// 		};
		// 	});
		// });

		const gitlabApi = new GitlabApi('', '', '');
		(gitlabApi.updateMergeRequest as jest.Mock)
			.mockImplementation(() => Promise.resolve({
				// mock response here
			}));

		jest.mock('../Worker');

		//const mockedGitlabApi = GitlabApi as jest.MockedClass<typeof GitlabApi>;
		//mockedGitlabApi.updateMergeRequest.mockImplementation(() => {});
		//const gitlabApi = new mockedGitlabApi('', '', '');
		//const gitlabApi = new GitlabApi('', '', '');
		// gitlabApi.updateMergeRequest.mockImplementation(() => Promise.resolve({
		// 	// mock response here
		// }));

		const mockedUser = {
			id: 1,
			avatar_url: '',
			email: '',
			name: '',
			username: '',
			web_url: '',
		} as User;

		const pubSub = new PubSub();
		const config = {
			...defaultConfig,
			PROJECT_IDS: ['2'],
		};

		const worker = new Worker(pubSub, config);

		const mergeRequest = {
			id: 1,
			assignee: null,
			assignees: [],
			author: {id: 1 , username: 'ss'},
			iid: 1,
			blocking_discussions_resolved: true,
			force_remove_source_branch: true,
			merge_status: MergeStatus.CanBeMerged,
			labels: [],
			has_conflicts: false,
			project_id: 1,
			references: {full: ''},
			source_branch: 'foo',
			squash: true,
			source_project_id: 1,
			state: MergeState.Opened,
			web_url: 'https://',
			target_branch: 'master',
			title: 'title',
			target_project_id: 1,
			work_in_progress: false,

		} as MergeRequest;

		await prepareMergeRequestForMerge(gitlabApi, mockedUser, worker, config, mergeRequest);

		expect(gitlabApi.updateMergeRequest).toHaveBeenCalledTimes(1);
		expect(gitlabApi.createMergeRequestNote).toHaveBeenCalledTimes(1);
	});
});
