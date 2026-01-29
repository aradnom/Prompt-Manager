import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RasterIcon } from "@/components/RasterIcon";

export default function LMStudioCors() {
  return (
    <main className="standard-page-container">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="question-mark" size={36} />
          LM Studio &amp; CORS
        </h1>
        <p className="text-cyan-medium mb-8">
          <mark className="highlighted-text">
            How to connect Prompt Manager to LM Studio
          </mark>
        </p>
      </motion.div>

      <div className="space-y-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-background/50">
            <CardHeader>
              <CardTitle className="text-magenta-light">
                What's Going On?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-foreground">
              <p>
                Prompt Manager talks to LM Studio directly from your browser.
                When your browser makes a request to a different origin (a
                different host or port), the target server has to explicitly
                allow it. This is called{" "}
                <strong>CORS (Cross-Origin Resource Sharing)</strong>.
              </p>
              <p>
                By default, LM Studio does not enable CORS, which means your
                browser will block the request even though LM Studio is running
                right there on your machine. The fix is a single toggle in LM
                Studio's settings.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-background/50">
            <CardHeader>
              <CardTitle className="text-magenta-light">
                How to Enable CORS in LM Studio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-foreground">
              <ol className="list-decimal list-inside space-y-3 ml-2">
                <li>
                  Make sure LM Studio is in{" "}
                  <strong>Power User or Developer mode</strong>. You can check
                  and change this in the lower-left corner of the LM Studio
                  window.
                </li>
                <li>
                  Go to the <strong>Developer</strong> tab (upper-left area, the
                  terminal icon).
                </li>
                <li>
                  Click on <strong>Server Settings</strong> (top of the panel,
                  just to the right of the Status toggle).
                </li>
                <li>
                  Make sure <strong>Enable CORS</strong> is turned on.
                </li>
              </ol>
              <p className="text-cyan-medium text-sm mt-4">
                Once CORS is enabled, come back here and try your LM Studio
                operation again. No restart should be necessary.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="bg-background/50">
            <CardHeader>
              <CardTitle className="text-magenta-light">
                Still Not Working?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-foreground">
              <p>
                If you've enabled CORS and it's still not connecting, check
                that:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>
                  LM Studio's server is actually running (the Status toggle
                  should be on)
                </li>
                <li>
                  The URL in your Account settings matches LM Studio's server
                  address and port
                </li>
                <li>A model is loaded in LM Studio</li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
