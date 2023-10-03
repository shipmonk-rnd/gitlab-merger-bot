import { defaultConfig } from '../Config';
import { isMergeRequestFromSupportedProject } from '../MergeRequestReceiver';

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
