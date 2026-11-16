import { api } from "@/services/api";
import { unwrap } from "@/services/unwrap";
import type { AppConfig, ConfigPatch, PublicConfig } from "../types";

export const fetchPublicConfig = async () => unwrap<PublicConfig>(await api.config.public.get());
export const fetchConfig = async () => unwrap<AppConfig>(await api.config.get());
export const updateConfig = async (patch: ConfigPatch) => unwrap<AppConfig>(await api.config.patch(patch));
export const uploadLogo = async (file: File) => unwrap<AppConfig>(await api.config.logo.post({ file }));
export const removeLogo = async () => unwrap<AppConfig>(await api.config.logo.delete());
