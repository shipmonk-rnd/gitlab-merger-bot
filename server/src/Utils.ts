import { Config } from './Config';

export const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

export const shouldMergeRequestBeProcessed = (
	config: Config,
	mergeRequestProjectId: number,
): boolean => {
	if (config.PROJECT_IDS.toString() === [''].toString()) {
		return true;
	}

	return config.PROJECT_IDS.map(Number).includes(mergeRequestProjectId);
};
