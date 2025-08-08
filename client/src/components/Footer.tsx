import { Camera, Mail, Phone, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <Camera className="h-8 w-8 text-transparent bg-gradient-to-r from-pink-500 via-orange-500 to-yellow-500 bg-clip-text" />
              <span className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-orange-500 to-cyan-500 bg-clip-text text-transparent">
                PinMyPic
              </span>
            </div>
            <p className="text-gray-400 leading-relaxed">
              Professional photography services with AI-powered face recognition
              technology. Capture every moment, find every memory.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/events"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Events
                </Link>
              </li>
              <li>
                <Link
                  to="/events"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  FindMyFace
                </Link>
              </li>
              <li>
                <Link
                  to="/booking"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Booking
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Services</h3>
            <ul className="space-y-2">
              <li className="text-gray-400">Wedding Photography</li>
              <li className="text-gray-400">Corporate Events</li>
              <li className="text-gray-400">Birthday Parties</li>
              <li className="text-gray-400">Face Recognition</li>
              <li className="text-gray-400">Photo Downloads</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Info</h3>
            <ul className="space-y-3">
              <li className="flex items-center text-gray-400">
                <Mail className="h-4 w-4 mr-3" />
                Dinesh@pinmypic.com
              </li>
              <li className="flex items-center text-gray-400">
                <Phone className="h-4 w-4 mr-3" />
                +91 9025943634
              </li>
              <li className="flex items-center text-gray-400">
                <MapPin className="h-4 w-4 mr-3" />
                Coimbatore, Tamil Nadu
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center">
          <p className="text-gray-400">
            © 2025 PinMyPic. All rights reserved. | Made with ❤️ for
            photographers
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
