import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MahoragaApi implements ICredentialType {
	name = 'mahoragaApi';

	displayName = 'Mahoraga API';

	documentationUrl = 'https://github.com/connectserverlab-del/mahoraga';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://mahoraga:8080',
			placeholder: 'http://mahoraga:8080',
			description: 'Base URL of the Mahoraga HTTP service',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Optional. Required only if the service sets MAHORAGA_API_KEY.',
		},
	];

	// Sends the API key as the X-API-Key header on every request.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/health',
		},
	};
}
