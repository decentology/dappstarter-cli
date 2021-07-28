export type DevelopConfigBase = {
	projectUrl: string;
};

export type DevelopConfig = {
	privateKey: string;
	publicKey: string;
} & DevelopConfigBase;
