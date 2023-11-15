import { GitlabApi, MergeRequest, MergeRequestApprovalRule } from './GitlabApi';
import { sendNote } from './SendNote';

export const isApprovedByMergeFreezeApprovers = async (
	gitlabApi: GitlabApi,
	mergeRequest: MergeRequest,
	allowedApprovers: string[],
): Promise<boolean> => {
	const approvals = await gitlabApi.getMergeRequestApprovals(
		mergeRequest.project_id,
		mergeRequest.iid,
	);

	for (const approval of approvals.approved_by) {
		for (const allowerApproverId of allowedApprovers) {
			if (approval.user.id === parseInt(allowerApproverId)) {
				return true;
			}
		}
	}

	return false;
};
