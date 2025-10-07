import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Shield, RefreshCw } from 'lucide-react';

interface CaptchaVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (captchaResponse: string) => void;
  title?: string;
  description?: string;
  actionText?: string;
  loading?: boolean;
}

export const CaptchaVerification: React.FC<CaptchaVerificationProps> = ({
  isOpen,
  onClose,
  onVerify,
  title = "Security Verification Required",
  description = "To confirm this destructive action, please complete the verification below.",
  actionText = "DELETE ALL PHOTOS",
  loading = false
}) => {
  const [captchaText, setCaptchaText] = useState('');
  const [captchaChallenge, setCaptchaChallenge] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  // Generate a simple math captcha
  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operation = Math.random() > 0.5 ? '+' : '-';
    
    let challenge = '';
    let answer = 0;
    
    if (operation === '+') {
      challenge = `${num1} + ${num2}`;
      answer = num1 + num2;
    } else {
      // Ensure positive result for subtraction
      const larger = Math.max(num1, num2);
      const smaller = Math.min(num1, num2);
      challenge = `${larger} - ${smaller}`;
      answer = larger - smaller;
    }
    
    setCaptchaChallenge(challenge);
    return answer;
  };

  const [correctAnswer, setCorrectAnswer] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      const answer = generateCaptcha();
      setCorrectAnswer(answer);
      setCaptchaText('');
      setIsValid(false);
      setAttempts(0);
      setIsBlocked(false);
    }
  }, [isOpen]);

  const handleCaptchaChange = (value: string) => {
    setCaptchaText(value);
    const numValue = parseInt(value);
    setIsValid(!isNaN(numValue) && numValue === correctAnswer);
  };

  const handleSubmit = () => {
    if (isValid) {
      onVerify('DELETE_ALL_PHOTOS_CONFIRMED');
    } else {
      setAttempts(prev => prev + 1);
      if (attempts >= 2) {
        setIsBlocked(true);
        setTimeout(() => {
          setIsBlocked(false);
          setAttempts(0);
          const answer = generateCaptcha();
          setCorrectAnswer(answer);
          setCaptchaText('');
          setIsValid(false);
        }, 30000); // Block for 30 seconds
      } else {
        // Generate new captcha
        const answer = generateCaptcha();
        setCorrectAnswer(answer);
        setCaptchaText('');
        setIsValid(false);
      }
    }
  };

  const handleRefresh = () => {
    const answer = generateCaptcha();
    setCorrectAnswer(answer);
    setCaptchaText('');
    setIsValid(false);
  };

  if (isBlocked) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Shield className="h-5 w-5" />
              Security Blocked
            </DialogTitle>
            <DialogDescription>
              Too many failed attempts. Please wait 30 seconds before trying again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Warning: This action cannot be undone
            </div>
            <p className="text-sm text-red-700 mt-1">
              All selected photos will be permanently deleted from the system.
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="captcha" className="text-sm font-medium">
              Security Verification
            </Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 p-3 rounded border font-mono text-lg text-center">
                {captchaChallenge} = ?
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            
            <Input
              id="captcha"
              type="number"
              placeholder="Enter the answer"
              value={captchaText}
              onChange={(e) => handleCaptchaChange(e.target.value)}
              className={isValid ? 'border-green-500' : attempts > 0 ? 'border-red-500' : ''}
            />
            
            {attempts > 0 && !isValid && (
              <p className="text-sm text-red-600">
                Incorrect answer. {3 - attempts} attempts remaining.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                actionText
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
