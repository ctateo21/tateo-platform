import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ReferralSourceKind = "licensed_professional" | "social_media" | "word_of_mouth";

export type SocialPlatform =
  | "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin" | "google" | "other";

export interface ReferralSourcePayload {
  referral_source: ReferralSourceKind;
  referral_name?: string;
  referral_platform?: SocialPlatform;
  referral_notes?: string;
  answered_at: string;
}

const SESSION_KEY = "tateo.referralSource";

/** Returns the previously-answered referral payload for this browser
 *  session, or null. Lead-create code paths can read this to attach
 *  source data to any submission / FUB alert. */
export function getStoredReferralSource(): ReferralSourcePayload | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as ReferralSourcePayload) : null;
  } catch {
    return null;
  }
}

function saveReferralSource(p: ReferralSourcePayload) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(p)); } catch { /* sessionStorage may be unavailable */ }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the user picks a valid answer and clicks Continue.
   *  Caller is responsible for the existing Schedule-a-Call navigation. */
  onContinue: (payload: ReferralSourcePayload) => void;
}

export function ReferralSourceDialog({ open, onOpenChange, onContinue }: Props) {
  const [source, setSource] = useState<ReferralSourceKind | "">("");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform | "">("");

  const canContinue =
    (source === "licensed_professional" && name.trim().length > 0) ||
    (source === "social_media" && platform !== "") ||
    source === "word_of_mouth";

  function reset() { setSource(""); setName(""); setPlatform(""); }

  function handleContinue() {
    if (!source || !canContinue) return;
    const payload: ReferralSourcePayload = {
      referral_source: source,
      answered_at: new Date().toISOString(),
      ...(source === "licensed_professional" && { referral_name: name.trim() }),
      ...(source === "social_media" && platform && { referral_platform: platform }),
      ...(source === "word_of_mouth" && name.trim() && { referral_name: name.trim() }),
    };
    saveReferralSource(payload);
    onContinue(payload);
    reset();
  }

  function handleCancel() {
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md" data-testid="referral-source-dialog">
        <DialogHeader>
          <DialogTitle>How did you hear from us?</DialogTitle>
          <DialogDescription>
            Quick question before we get you scheduled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup
            value={source}
            onValueChange={v => { setSource(v as ReferralSourceKind); setName(""); setPlatform(""); }}
            className="space-y-2"
          >
            <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover-elevate has-[input:checked]:border-primary">
              <RadioGroupItem value="licensed_professional" data-testid="referral-option-licensed" />
              <span>Licensed Professional</span>
            </Label>
            <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover-elevate has-[input:checked]:border-primary">
              <RadioGroupItem value="social_media" data-testid="referral-option-social" />
              <span>Social Media</span>
            </Label>
            <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover-elevate has-[input:checked]:border-primary">
              <RadioGroupItem value="word_of_mouth" data-testid="referral-option-wom" />
              <span>Word of Mouth</span>
            </Label>
          </RadioGroup>

          {source === "licensed_professional" && (
            <div className="space-y-1.5">
              <Label htmlFor="referral-name-licensed">Who referred you? <span className="text-destructive">*</span></Label>
              <Input
                id="referral-name-licensed"
                data-testid="referral-name-licensed"
                placeholder="Enter their name"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                We may contact them to thank them or coordinate next steps.
              </p>
            </div>
          )}

          {source === "social_media" && (
            <div className="space-y-1.5">
              <Label htmlFor="referral-platform">Which platform? <span className="text-destructive">*</span></Label>
              <Select value={platform} onValueChange={v => setPlatform(v as SocialPlatform)}>
                <SelectTrigger id="referral-platform" data-testid="referral-platform">
                  <SelectValue placeholder="Choose a platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {source === "word_of_mouth" && (
            <div className="space-y-1.5">
              <Label htmlFor="referral-name-wom">Who referred you?</Label>
              <Input
                id="referral-name-wom"
                data-testid="referral-name-wom"
                placeholder="Enter their name, if you'd like"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCancel} data-testid="referral-cancel">Cancel</Button>
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            data-testid="referral-continue"
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
