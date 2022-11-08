import { notifyIfMergeRequestIsSelfApproved } from '../NotifyIfMergeRequestIsSelfApproved';
import {
	GitlabApi,
	MergeRequest,
	MergeRequestApprovals,
	MergeRequestApprovalState,
	MergeRequestUserApprover,
	MergeState,
	MergeStatus,
} from '../GitlabApi';

const mergeRequest: MergeRequest = {
	assignee: null,
	assignees: [],
	blocking_discussions_resolved: false,
	force_remove_source_branch: false,
	has_conflicts: false,
	id: 0,
	labels: [],
	merge_status: MergeStatus.Merged,
	references: { full: '' },
	source_branch: '',
	source_project_id: 0,
	squash: false,
	state: MergeState.Merged,
	target_branch: '',
	target_project_id: 0,
	title: '',
	web_url: '',
	work_in_progress: false,
	iid: 1,
	project_id: 1,
	author: {
		id: 11,
		username: 'username1',
	},
};

const approvalStateResponse: MergeRequestApprovalState = {
	rules: [
		{
			name: 'All Members',
			rule_type: 'any_approver',
			eligible_approvers: [],
		},
		{
			name: '/backend/',
			rule_type: 'code_owner',
			eligible_approvers: [
				{
					id: mergeRequest.author.id,
					username: mergeRequest.author.username,
				},
				{
					id: 12,
					username: 'username2',
				},
				{
					id: 13,
					username: 'username3',
				},
			],
		},
	],
};

const mergeRequestApprovalsResponse: MergeRequestApprovals = {
	approvals_required: 1,
	approvals_left: 0,
	approved_by: [
		{
			user: {
				id: mergeRequest.author.id,
				username: mergeRequest.author.username,
			},
		},
	],
};

jest.mock('../GitlabApi');

const GitlabApiMock = GitlabApi as jest.Mock;

it('self approve message format', async () => {
	const gitlabApiMock = new GitlabApiMock('url', 'token', undefined);

	gitlabApiMock.getMergeRequestApprovalState.mockResolvedValue(approvalStateResponse);
	gitlabApiMock.getMergeRequestApprovals.mockResolvedValue(mergeRequestApprovalsResponse);

	await notifyIfMergeRequestIsSelfApproved(gitlabApiMock, mergeRequest);

	const expectedBody = `
#postmergeapprove
====
Merge request was self-approved by @username1. You need to get second approve from anybody but you. They should reply l thread with 'Approved' message to post-approve this MR.
Code owners:
/backend/: @username2 @username3
`;
	expect(
		gitlabApiMock.createMergeRequestNote.mock.calls[
			gitlabApiMock.createMergeRequestNote.mock.calls.length - 1
		],
	).toEqual([mergeRequest.project_id, mergeRequest.iid, expectedBody]);
});

type ApproversTuple = [number, number[], number];

it.each<ApproversTuple>([
	[1, [1], 1],
	[1, [1, 2], 0],
	[1, [2, 3], 0],
	[1, [2], 0],
])('self approve', async (author: number, approvers: number[], expectedCalls: number) => {
	const gitlabApiMock = new GitlabApiMock('url', 'token', undefined);

	const mergeRequestApprovalsResponse: MergeRequestApprovals = {
		approvals_required: 1,
		approvals_left: 0,
		approved_by: approvers.map(
			(userId: number): MergeRequestUserApprover => {
				return {
					user: {
						username: `username${userId}`,
						id: userId,
					},
				};
			},
		),
	};

	gitlabApiMock.getMergeRequestApprovals.mockResolvedValue(mergeRequestApprovalsResponse);
	gitlabApiMock.getMergeRequestApprovalState.mockResolvedValue(approvalStateResponse);

	await notifyIfMergeRequestIsSelfApproved(gitlabApiMock, {
		...mergeRequest,
		...{ author: { id: author, username: `username${author}` } },
	});

	expect(gitlabApiMock.createMergeRequestNote).toBeCalledTimes(expectedCalls);
});
