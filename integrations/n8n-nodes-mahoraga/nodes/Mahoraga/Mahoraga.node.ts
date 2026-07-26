import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class Mahoraga implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mahoraga',
		name: 'mahoraga',
		icon: 'file:mahoraga.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ "Run browser task" }}',
		description: 'Run an AI browser-automation task via Mahoraga (BrowserOS kernel)',
		defaults: {
			name: 'Mahoraga',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'mahoragaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Run Browser Task',
						value: 'runTask',
						description: 'Execute a natural-language browser task and return the result',
						action: 'Run a browser task',
					},
				],
				default: 'runTask',
			},
			{
				displayName: 'Task',
				name: 'task',
				type: 'string',
				typeOptions: { rows: 3 },
				required: true,
				default: '',
				placeholder: 'Find the number of stars of the browser-use repo',
				description: 'What the agent should do, in plain English',
				displayOptions: { show: { operation: ['runTask'] } },
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { operation: ['runTask'] } },
				options: [
					{
						displayName: 'LLM Provider',
						name: 'provider',
						type: 'options',
						options: [
							{ name: 'Anthropic', value: 'anthropic' },
							{ name: 'OpenAI', value: 'openai' },
							{ name: 'Google', value: 'google' },
							{ name: 'Browser Use', value: 'browser-use' },
							{ name: 'Groq', value: 'groq' },
							{ name: 'Ollama', value: 'ollama' },
						],
						default: 'anthropic',
						description: 'Override the service default provider',
					},
					{
						displayName: 'Model',
						name: 'model',
						type: 'string',
						default: '',
						description: 'Override the provider default model',
					},
					{
						displayName: 'Max Steps',
						name: 'maxSteps',
						type: 'number',
						default: 50,
						typeOptions: { minValue: 1, maxValue: 500 },
					},
					{
						displayName: 'Use Vision',
						name: 'useVision',
						type: 'boolean',
						default: true,
						description: 'Whether to send screenshots to the LLM',
					},
					{
						displayName: 'BrowserOS Kernel CDP URL',
						name: 'cdpUrl',
						type: 'string',
						default: '',
						placeholder: 'http://browseros:9222',
						description: 'Override the BrowserOS kernel to drive for this task',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('mahoragaApi');
		const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

		for (let i = 0; i < items.length; i++) {
			const task = this.getNodeParameter('task', i) as string;
			const options = this.getNodeParameter('additionalOptions', i, {}) as IDataObject;

			const body: IDataObject = { task };
			if (options.provider) body.provider = options.provider;
			if (options.model) body.model = options.model;
			if (options.maxSteps) body.max_steps = options.maxSteps;
			if (options.useVision !== undefined) body.use_vision = options.useVision;
			if (options.cdpUrl) body.cdp_url = options.cdpUrl;

			const response = (await this.helpers.httpRequestWithAuthentication.call(
				this,
				'mahoragaApi',
				{
					method: 'POST' as IHttpRequestMethods,
					url: `${baseUrl}/v1/tasks`,
					body,
					json: true,
				},
			)) as IDataObject;

			if (response.success === false && this.continueOnFail() === false) {
				throw new NodeOperationError(
					this.getNode(),
					`Mahoraga task failed: ${response.error ?? 'unknown error'}`,
					{ itemIndex: i },
				);
			}

			returnData.push({ json: response, pairedItem: { item: i } });
		}

		return [returnData];
	}
}
