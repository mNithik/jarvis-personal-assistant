import { useJarvisAppRoot } from "../../hooks/useJarvisAppRoot";

/** Wave D: shell orchestration lives in useJarvisAppRoot; this file stays a thin entry. */
export default function JarvisAppRootLogic() {
  return useJarvisAppRoot();
}
