import { defaultConfig } from '../Config';
import { shouldMergeRequestBeProcessed } from '../Utils';

it('discard external MR', async () => {
	expect(
		shouldMergeRequestBeProcessed(
			{
				...defaultConfig,
				PROJECT_IDS: '',
			},
			1,
		),
	).toBe(true);

	expect(
		shouldMergeRequestBeProcessed(
			{
				...defaultConfig,
				PROJECT_IDS: '1',
			},
			1,
		),
	).toBe(true);
	expect(
		shouldMergeRequestBeProcessed(
			{
				...defaultConfig,
				PROJECT_IDS: '1,2,3',
			},
			2,
		),
	).toBe(true);

	expect(
		shouldMergeRequestBeProcessed(
			{
				...defaultConfig,
				PROJECT_IDS: '2',
			},
			0,
		),
	).toBe(false);
});
