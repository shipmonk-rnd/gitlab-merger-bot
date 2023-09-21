import { defaultConfig } from '../Config';
import { canBeMergeRequestProcessed } from '../Utils';

it('discard external MR', async () => {
	expect(
		canBeMergeRequestProcessed(
			{
				...defaultConfig,
				PROJECT_IDS: '',
			},
			1,
		),
	).toBe(true);

	expect(
		canBeMergeRequestProcessed(
			{
				...defaultConfig,
				PROJECT_IDS: '1',
			},
			1,
		),
	).toBe(true);
	expect(
		canBeMergeRequestProcessed(
			{
				...defaultConfig,
				PROJECT_IDS: '1,2,3',
			},
			2,
		),
	).toBe(true);

	expect(
		canBeMergeRequestProcessed(
			{
				...defaultConfig,
				PROJECT_IDS: '2',
			},
			0,
		),
	).toBe(false);
});
