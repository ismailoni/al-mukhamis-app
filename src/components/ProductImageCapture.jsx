/* eslint-disable react/prop-types */
import { useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { takePhoto, pickPhoto, saveImageToDevice } from "../lib/camera";
import toast from "react-hot-toast";

/**
 * Mobile-optimized image capture component for products
 */
export function ProductImageCapture({ onImageCapture, initialImage = null }) {
  const [image, setImage] = useState(initialImage);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleCameraCapture = async () => {
    try {
      setIsLoading(true);
      const base64Image = await takePhoto();
      const filename = await saveImageToDevice(base64Image);
      setImage({
        base64: base64Image,
        filename,
        timestamp: new Date().toISOString(),
      });
      onImageCapture({
        base64: base64Image,
        filename,
      });
      toast.success("Photo captured!");
    } catch (error) {
      console.error("Error capturing photo:", error);
      toast.error("Failed to capture photo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGalleryPick = async () => {
    try {
      setIsLoading(true);
      const base64Image = await pickPhoto();
      const filename = await saveImageToDevice(base64Image);
      setImage({
        base64: base64Image,
        filename,
        timestamp: new Date().toISOString(),
      });
      onImageCapture({
        base64: base64Image,
        filename,
      });
      toast.success("Photo selected!");
    } catch (error) {
      console.error("Error picking photo:", error);
      toast.error("Failed to select photo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    onImageCapture(null);
    toast.success("Image removed");
  };

  return (
    <div className="space-y-4">
      <Label>Product Image</Label>

      {image ? (
        <div className="space-y-2">
          <div className="relative w-full overflow-hidden bg-gray-100 rounded-lg aspect-square">
            <img
              src={`data:image/jpeg;base64,${image.base64}`}
              alt="Product"
              className="object-cover w-full h-full"
            />
            <button
              onClick={() => setShowPreview(true)}
              className="absolute inset-0 flex items-center justify-center transition-colors opacity-0 bg-black/0 hover:bg-black/20 hover:opacity-100"
            >
              View Full
            </button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCameraCapture}
              disabled={isLoading}
              className="flex-1 gap-2"
            >
              <Camera className="w-4 h-4" />
              Retake
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRemoveImage}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            onClick={handleCameraCapture}
            disabled={isLoading}
            className="w-full gap-2"
            size="lg"
          >
            <Camera className="w-5 h-5" />
            {isLoading ? "Capturing..." : "Take Photo"}
          </Button>
          <Button
            onClick={handleGalleryPick}
            disabled={isLoading}
            variant="outline"
            className="w-full"
            size="lg"
          >
            {isLoading ? "Loading..." : "Choose from Gallery"}
          </Button>
        </div>
      )}

      {/* Full screen image preview */}
      {showPreview && image && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
          <img
            src={`data:image/jpeg;base64,${image.base64}`}
            alt="Product Full"
            className="object-contain w-full h-full"
          />
          <Button
            onClick={() => setShowPreview(false)}
            className="absolute top-4 right-4"
            size="lg"
            variant="ghost"
          >
            <X className="w-6 h-6 text-white" />
          </Button>
        </div>
      )}
    </div>
  );
}
