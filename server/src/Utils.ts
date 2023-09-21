import { Config } from './Config';

export const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

export const canBeMergeRequestProcessed = (
	config: Config,
	mergeRequestProjectId: number,
): boolean => {
	if (config.PROJECT_IDS === '') {
		return true;
	}

	return config.PROJECT_IDS.toString().split(',').map(Number).includes(mergeRequestProjectId);
};
