import { GitlabApi, MergeRequest, MergeStatus, User } from './GitlabApi';
import { assignToAuthorAndResetLabels } from './AssignToAuthor';
import { sendNote } from './SendNote';
import {
	acceptMergeRequest,
	AcceptMergeRequestResultKind,
	BotLabels,
	runAcceptingMergeRequest,
} from './MergeRequestAcceptor';
import { resolveMergeRequestResult } from './MergeRequestResultResolver';
import { setBotLabels } from './BotLabelsSetter';
import { Worker } from './Worker';
import { Config } from './Config';
import { JobInfo, JobPriority } from './generated/graphqlgen';

export const isMergeRequestFromSupportedProject = (
	mergeRequestProjectId: string,
	config: Config,
): boolean => {
	if (config.PROJECT_IDS === undefined) {
		return true;
	}

	return config.PROJECT_IDS.includes(mergeRequestProjectId);
};

export const prepareMergeRequestForMerge = async (
	gitlabApi: GitlabApi,
	user: User,
	worker: Worker,
	config: Config,
	mergeRequest: MergeRequest,
) => {
	const jobId = `accept-merge-${mergeRequest.id}`;
	const jobPriority = mergeRequest.labels.includes(config.HIGH_PRIORITY_LABEL)
		? JobPriority.HIGH
		: JobPriority.NORMAL;
	const jobInfo: JobInfo = {
		mergeRequest: {
			iid: mergeRequest.iid,
			projectId: mergeRequest.target_project_id,
			authorId: mergeRequest.author.id,
			title: mergeRequest.title,
			webUrl: mergeRequest.web_url,
		},
	};

	if (!isMergeRequestFromSupportedProject(mergeRequest.project_id.toString(10), config)) {
		console.log(
			`[loop][${mergeRequest.iid}] Merge request is excluded from processing as it belongs to different project (${mergeRequest.project_id}), assigning back`,
		);

		await Promise.all([
			assignToAuthorAndResetLabels(gitlabApi, mergeRequest, user),
			sendNote(
				gitlabApi,
				mergeRequest,
				`Merge request can't be merged, I'm not allowed to work with MRs from foreign projects.`,
			),
		]);

		return;
	}

	const currentJob = worker.findJob(mergeRequest.project_id, jobId);
	if (currentJob !== null) {
		currentJob.updateInfo(jobInfo);
	}

	const currentJobPriority = worker.findJobPriorityInQueue(mergeRequest.project_id, jobId);
	if (currentJobPriority === jobPriority) {
		return;
	}

	if (currentJobPriority !== null) {
		console.log(`[loop][MR][${mergeRequest.iid}] Changing job priority to ${jobPriority}.`);
		await worker.setJobPriority(mergeRequest.target_project_id, jobId, jobPriority);
		return;
	}

	if (
		mergeRequest.merge_status !== MergeStatus.CanBeMerged &&
		mergeRequest.merge_status !== MergeStatus.Checking &&
		mergeRequest.merge_status !== MergeStatus.Unchecked
	) {
		console.log(
			`[loop][MR][${mergeRequest.iid}] Merge request can't be merged. Merge status is ${mergeRequest.merge_status}, assigning back`,
		);

		await Promise.all([
			assignToAuthorAndResetLabels(gitlabApi, mergeRequest, user),
			sendNote(
				gitlabApi,
				mergeRequest,
				`Merge request can't be merged. Probably it needs rebase to target branch.`,
			),
		]);

		return;
	}

	if (mergeRequest.work_in_progress) {
		console.log(`[loop][MR][${mergeRequest.iid}] Merge request is a draft, assigning back`);

		await Promise.all([
			assignToAuthorAndResetLabels(gitlabApi, mergeRequest, user),
			sendNote(
				gitlabApi,
				mergeRequest,
				`Merge request is marked as a draft, I can't merge it`,
			),
		]);

		return;
	}

	if (!mergeRequest.blocking_discussions_resolved) {
		console.log(
			`[loop][MR][${mergeRequest.iid}] Merge request has unresolved discussion, assigning back`,
		);

		await Promise.all([
			assignToAuthorAndResetLabels(gitlabApi, mergeRequest, user),
			sendNote(
				gitlabApi,
				mergeRequest,
				`Merge request has unresolved discussion, I can't merge it`,
			),
		]);

		return;
	}

	if (mergeRequest.has_conflicts) {
		console.log(`[loop][MR][${mergeRequest.iid}] MR has conflict`);

		await Promise.all([
			assignToAuthorAndResetLabels(gitlabApi, mergeRequest, user),
			sendNote(gitlabApi, mergeRequest, "Merge request can't be merged: MR has conflict"),
		]);

		return;
	}

	const approvals = await gitlabApi.getMergeRequestApprovals(
		mergeRequest.project_id,
		mergeRequest.iid,
	);
	if (approvals.approvals_left > 0) {
		console.log(
			`[loop][MR][${mergeRequest.iid}] Merge request is waiting for approvals, assigning back`,
		);

		await Promise.all([
			assignToAuthorAndResetLabels(gitlabApi, mergeRequest, user),
			sendNote(
				gitlabApi,
				mergeRequest,
				`Merge request is waiting for approvals. Required ${approvals.approvals_required}, but ${approvals.approvals_left} left.`,
			),
		]);

		return;
	}

	if (jobPriority === JobPriority.HIGH) {
		const mergeResponse = await acceptMergeRequest(
			gitlabApi,
			mergeRequest.target_project_id,
			mergeRequest.iid,
			user,
			config,
		);
		if (mergeResponse.kind === AcceptMergeRequestResultKind.SuccessfullyMerged) {
			console.log(`[loop][MR][${mergeRequest.iid}] High-priority merge request is merged`);
			return;
		}
		console.log(
			`[loop][MR][${mergeRequest.iid}] High-priority merge request is not acceptable in this moment.`,
		);
	}

	console.log(
		`[loop][MR][${mergeRequest.iid}] Adding job to the queue with ${jobPriority} priority.`,
	);
	worker.registerJobToQueue(
		mergeRequest.target_project_id,
		{
			projectName: mergeRequest.references.full.split('!')[0],
		},
		jobPriority,
		jobId,
		async ({ success, job }) => {
			const result = await runAcceptingMergeRequest(
				job,
				gitlabApi,
				mergeRequest.target_project_id,
				mergeRequest.iid,
				user,
				config,
			);
			if (result === undefined) {
				return;
			}

			console.log(`Finishing job: ${JSON.stringify(result)}`);
			success();
			await resolveMergeRequestResult(gitlabApi, result);
		},
		jobInfo,
	);

	await setBotLabels(gitlabApi, mergeRequest, [BotLabels.InMergeQueue]);
};
