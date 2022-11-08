import {
	GitlabApi,
	MergeRequest,
	MergeRequestApprovalRule,
	MergeRequestInfo,
	User,
} from './GitlabApi';
import { sendNote } from './SendNote';

const authorIsOnlyApprover = async (
	gitlabApi: GitlabApi,
	mergeRequest: MergeRequest,
): Promise<boolean> => {
	const approvals = await gitlabApi.getMergeRequestApprovals(
		mergeRequest.project_id,
		mergeRequest.iid,
	);

	// If there are multiple approvals we don't check if author is among them. Not marking it as self-approved
	if (approvals.approved_by.length > 1) {
		return false;
	}

	for (const approval of approvals.approved_by) {
		if (approval.user.id === mergeRequest.author.id) {
			return true;
		}
	}

	return false;
};

const getUsernamesOfEligibleApproversWithoutAuthor = (
	approvalRule: MergeRequestApprovalRule,
	mergeRequest: MergeRequest,
): string[] => {
	const usernames: string[] = [];
	for (const approver of approvalRule.eligible_approvers) {
		if (approver.id === mergeRequest.author.id) {
			continue;
		}

		usernames.push(`@${approver.username}`);
	}

	return usernames;
};

const findCodeOwnerApprovalRulesAuthorBelongsTo = (
	mergeRequest: MergeRequest,
	approvalRules: MergeRequestApprovalRule[],
): MergeRequestApprovalRule[] => {
	const codeOwnerRules: MergeRequestApprovalRule[] = [];

	for (const rule of approvalRules) {
		if (rule.rule_type !== 'code_owner') {
			continue;
		}

		for (const approver of rule.eligible_approvers) {
			if (approver.id === mergeRequest.author.id) {
				codeOwnerRules.push(rule);
			}
		}
	}

	return codeOwnerRules;
};

interface MergeRequestCodeOwners {
	name: string;
	approverUsernames: string[];
}

export const notifyIfMergeRequestIsSelfApproved = async (
	gitlabApi: GitlabApi,
	mergeRequest: MergeRequest,
): Promise<void> => {
	if (await authorIsOnlyApprover(gitlabApi, mergeRequest)) {
		const approvalState = await gitlabApi.getMergeRequestApprovalState(
			mergeRequest.project_id,
			mergeRequest.iid,
		);

		const codeowners: MergeRequestCodeOwners[] = findCodeOwnerApprovalRulesAuthorBelongsTo(
			mergeRequest,
			approvalState.rules,
		).map(
			(approvalRule: MergeRequestApprovalRule): MergeRequestCodeOwners => {
				return {
					name: approvalRule.name,
					approverUsernames: getUsernamesOfEligibleApproversWithoutAuthor(
						approvalRule,
						mergeRequest,
					),
				};
			},
		);

		const message = `
#postmergeapprove
====
Merge request was self-approved by @${
			mergeRequest.author.username
		}. You need to get second approve from anybody but you. They should reply l thread with 'Approved' message to post-approve this MR.
Code owners:
${codeowners
	.map((mergeRequestCodeOwners: MergeRequestCodeOwners): string => {
		return `${mergeRequestCodeOwners.name}: ${mergeRequestCodeOwners.approverUsernames.join(
			' ',
		)}`;
	})
	.join('\n')}
`;

		await sendNote(gitlabApi, mergeRequest, message);
	}
};
