export type DevelopConfigBase = {
	projectUrl: string;
	projectName: string;
};

export type DevelopConfig = {
	privateKey: string;
	publicKey: string;
} & DevelopConfigBase;
